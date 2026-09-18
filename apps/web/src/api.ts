let csrf = "";
export const setCsrf = (value: string) => {
  csrf = value;
};
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrf,
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "서버에 연결할 수 없어요. 현재 탭의 코드는 유지됩니다.",
      0,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.code ?? "SYSTEM_ERROR",
      data.message ?? "요청을 처리하지 못했어요.",
      response.status,
    );
  return data;
}
export const post = (path: string, data: any) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export function loadGoogle() {
  if (window.google) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const current = document.querySelector("#google-identity");
    if (current) {
      current.addEventListener("load", () => resolve(), { once: true });
      current.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-identity";
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.append(script);
  });
}
export async function uploadDrive(blob: Blob, clientId: string, name: string) {
  await loadGoogle();
  return new Promise<void>((resolve, reject) => {
    const oauth = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: async (token: any) => {
        if (token.error)
          return reject(
            new ApiError(
              "DRIVE_PERMISSION",
              "Google Drive 권한을 허용해 주세요.",
              403,
            ),
          );
        try {
          const boundary = "algostep" + crypto.randomUUID();
          const body = new Blob(
            [
              `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: "application/pdf" })}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
              blob,
              `\r\n--${boundary}--`,
            ],
            { type: `multipart/related; boundary=${boundary}` },
          );
          const r = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token.access_token}` },
              body,
            },
          );
          if (!r.ok) throw new Error("Drive upload failed");
          resolve();
        } catch {
          reject(
            new ApiError(
              "DRIVE_FAILED",
              "Google Drive 저장을 완료하지 못했어요. PDF를 다운로드할 수 있어요.",
              503,
            ),
          );
        }
      },
      error_callback: () =>
        reject(
          new ApiError(
            "DRIVE_PERMISSION",
            "Google Drive 연결이 취소됐어요.",
            403,
          ),
        ),
    });
    oauth.requestAccessToken({ prompt: "consent" });
  });
}
