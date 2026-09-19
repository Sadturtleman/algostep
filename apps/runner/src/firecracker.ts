import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  copyFile,
  writeFile,
  rm,
  chown,
  link,
  lstat,
} from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createConnection } from "node:net";
import type { Job } from "./protocol.js";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function runIsolated(job: Job, signal?: AbortSignal) {
  if (process.platform !== "linux") throw new Error("KVM_LINUX_REQUIRED");
  await access("/dev/kvm", constants.R_OK | constants.W_OK);
  const firecracker =
    process.env.FIRECRACKER_BIN ?? "/usr/local/bin/firecracker";
  const jailer = process.env.JAILER_BIN ?? "/usr/local/bin/jailer";
  const base = resolve(process.env.RUNNER_WORKDIR ?? "/var/lib/algostep");
  const instance = `job-${job.id}`,
    parent = join(base, basename(firecracker), instance),
    root = join(parent, "root");
  await mkdir(root, { recursive: true });
  const kernel = process.env.KERNEL_PATH,
    rootfs = process.env.ROOTFS_PATH;
  if (!kernel || !rootfs) throw new Error("VM_IMAGES_NOT_CONFIGURED");
  let child: ReturnType<typeof spawn> | undefined;
  const kill = () => {
    child?.kill("SIGKILL");
  };
  signal?.addEventListener("abort", kill, { once: true });
  try {
    await copyFile(kernel, join(root, "vmlinux"));
    let sharedRootfs=false;
    const imageInfo=await lstat(rootfs);
    // Sharing is safe only for a root-owned immutable regular file. Never make
    // a shared inode writable by the VMM uid; all guest drives remain read-only.
    if(imageInfo.isFile() && imageInfo.uid===0 && (imageInfo.mode & 0o222)===0) {
      try {await link(rootfs,join(root,'rootfs.ext4'));sharedRootfs=true;}catch{ /* Cross-device filesystems use a private copy below. */ }
    }
    if(!sharedRootfs)await copyFile(rootfs,join(root,'rootfs.ext4'),constants.COPYFILE_FICLONE);
    await writeFile(
      join(root, "config.json"),
      JSON.stringify({
        "boot-source": {
          kernel_image_path: "/vmlinux",
          boot_args:
            "console=ttyS0 reboot=k panic=1 pci=off init=/init random.trust_cpu=on",
        },
        drives: [
          {
            drive_id: "rootfs",
            path_on_host: "/rootfs.ext4",
            is_root_device: true,
            is_read_only: true,
          },
        ],
        "machine-config": { vcpu_count: 1, mem_size_mib: 768, smt: false },
        vsock: { guest_cid: 3, uds_path: "/vsock.sock" },
      }),
    );
    const uid = Number(process.env.JAILER_UID ?? 1001),
      gid = Number(process.env.JAILER_GID ?? 1001);
    if (!Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(gid) || gid <= 0)
      throw new Error("JAILER_NON_ROOT_ID_REQUIRED");
    await chown(root, uid, gid);
    for (const name of ["vmlinux", ...(sharedRootfs?[]:["rootfs.ext4"]), "config.json"])
      await chown(join(root, name), uid, gid);
    signal?.throwIfAborted();
    // Jailer creates the chroot and applies uid/gid isolation. Never execute submitted code on this host.
    child = spawn(
      jailer,
      [
        "--id",
        instance,
        "--exec-file",
        firecracker,
        "--uid",
        process.env.JAILER_UID ?? "1001",
        "--gid",
        process.env.JAILER_GID ?? "1001",
        "--chroot-base-dir",
        base,
        "--",
        "--no-api",
        "--config-file",
        "/config.json",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let startError: Error | undefined;
    child.on("error", (e) => {
      startError = e;
    });
    let log = "";
    child.stderr?.on("data", (b) => {
      log = (log + String(b)).slice(-4096);
    });
    const socket = join(root, "vsock.sock");
    let connected = false;
    for (let n = 0; n < 150; n++) {
      signal?.throwIfAborted();
      if (startError) throw startError;
      if (child.exitCode !== null) throw new Error(`VM_BOOT_FAILED ${log}`);
      try {
        await access(socket);
        connected = true;
        break;
      } catch {
        await sleep(100);
      }
    }
    if (!connected) throw new Error("VM_BOOT_TIMEOUT");
    // Firecracker's host-side vsock handshake uses CONNECT <guest-port>.
    for (let tries = 0; tries < 60; tries++) {
      signal?.throwIfAborted();
      try {
        return await exchange(socket, job, signal);
      } catch (e) {
        if (
          tries === 59 ||
          !(e instanceof Error) ||
          !e.message.startsWith("VSOCK_NOT_READY")
        )
          throw e;
        await sleep(250);
      }
    }
    throw new Error("VM_AGENT_UNAVAILABLE");
  } finally {
    signal?.removeEventListener("abort", kill);
    if (child && child.exitCode === null) {
      const exited = new Promise<void>((r) => child!.once("exit", () => r()));
      child.kill("SIGKILL");
      await Promise.race([exited, sleep(3000)]);
    }
    if (!parent.startsWith(base + "/") || !/^job-[a-f0-9-]{36}$/.test(instance))
      throw new Error("INVALID_CLEANUP_PATH");
    await rm(parent, { recursive: true, force: true });
  }
}
function exchange(path: string, job: Job, signal?: AbortSignal): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path);
    let buffer = "",
      handshake = false,
      done = false;
    const abort = () => finish(new Error("LEASE_LOST"));
    const deadline = setTimeout(
      () => finish(new Error("VM_SUBMISSION_TIMEOUT")),
      job.limits.submissionMs + 15000,
    );
    const finish = (error?: Error, value?: any) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      error ? reject(error) : resolve(value);
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    socket.setTimeout(job.limits.submissionMs + 15000, () =>
      finish(new Error("VM_SUBMISSION_TIMEOUT")),
    );
    socket.on("connect", () => socket.write("CONNECT 5000\n"));
    socket.on("error", (e) =>
      finish(new Error(`VSOCK_NOT_READY ${e.message}`)),
    );
    socket.on("end", () => {
      if (!done)
        finish(
          new Error(handshake ? "VM_AGENT_DISCONNECTED" : "VSOCK_NOT_READY"),
        );
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (Buffer.byteLength(buffer) > 2 * 1024 * 1024)
        return finish(new Error("VM_RESULT_TOO_LARGE"));
      if (!handshake) {
        const nl = buffer.indexOf("\n");
        if (nl < 0) return;
        if (!buffer.slice(0, nl).startsWith("OK "))
          return finish(new Error("VSOCK_NOT_READY"));
        buffer = buffer.slice(nl + 1);
        handshake = true;
        socket.write(
          JSON.stringify({
            language: job.language,
            source: job.source,
            tests: job.tests,
            limits: job.limits,
          }) + "\n",
        );
      }
      const nl = buffer.indexOf("\n");
      if (nl >= 0) {
        try {
          finish(undefined, JSON.parse(buffer.slice(0, nl)));
        } catch {
          finish(new Error("INVALID_VM_RESULT"));
        }
      }
    });
  });
}
