import { readFileSync, writeFileSync, existsSync } from "node:fs";
const base = new URL(process.env.REDASH_URL ?? "https://invalid.local");
if (
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.search ||
  base.hash ||
  !process.env.REDASH_API_KEY ||
  !process.env.REDASH_DATABASE_URL ||
  !process.env.DATABASE_SSL_CA
)
  throw new Error(
    "Set HTTPS REDASH_URL, REDASH_API_KEY, read-only REDASH_DATABASE_URL and DATABASE_SSL_CA",
  );
const source = new URL(process.env.REDASH_DATABASE_URL);
if (
  !/^algostep_redash(?:\.[a-z0-9]+)?$/.test(decodeURIComponent(source.username))
)
  throw new Error("Only the restricted analytics reader may be used");
const origin = base.href.replace(/\/$/, "");
const statePath = process.env.REDASH_STATE_PATH ?? "tmp/redash-state.json";
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { origin, queries: {}, widgets: {} };
if (state.origin !== origin)
  throw new Error("State belongs to another Redash destination");
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
async function api(path, method = "GET", data) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      Authorization: "Key " + process.env.REDASH_API_KEY,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("REDASH_HTTP_" + r.status);
  return r.json();
}
try {
  const sources = await api("/api/data_sources");
  const existing = sources.find(
    (s) => s.name === "Algostep analytics (managed)",
  );
  if (state.sourceId && (!existing || existing.id !== state.sourceId))
    throw new Error("Managed data source does not match saved state");
  if (existing && !state.sourceId)
    throw new Error(
      "Existing data source requires original state file; refusing an ambiguous duplicate",
    );
  if (!state.sourceId) {
    const ds = await api("/api/data_sources", "POST", {
      name: "Algostep analytics (managed)",
      type: "pg",
      options: {
        host: source.hostname,
        port: Number(source.port || 5432),
        dbname: source.pathname.slice(1),
        user: decodeURIComponent(source.username),
        password: decodeURIComponent(source.password),
        sslmode: "verify-full",
        sslrootcertFile: readFileSync(process.env.DATABASE_SSL_CA).toString(
          "base64",
        ),
        dsn: "application_name=algostep-redash connect_timeout=10",
      },
    });
    state.sourceId = ds.id;
    save();
  }
  const checked = await api(
    `/api/data_sources/${state.sourceId}/test`,
    "POST",
    {},
  );
  if (checked.ok !== true) throw new Error("DATA_SOURCE_TEST_FAILED");
  if (!state.dashboardId) {
    const d = await api("/api/dashboards", "POST", {
      name: "Algostep 비즈니스 분석",
    });
    state.dashboardId = d.id;
    state.dashboardSlug = d.slug;
    save();
  }
  const definitions = JSON.parse(
    readFileSync(new URL("./redash-queries.json", import.meta.url), "utf8"),
  );
  for (let i = 0; i < definitions.length; i++) {
    const item = definitions[i];
    const body = {
      name: "[Algostep] " + item.name,
      query: item.query,
      data_source_id: state.sourceId,
      description:
        "Algostep managed analytics query. KST, pseudonymous users, no raw code or inquiry contents.",
      options: { parameters: [] },
      is_draft: false,
    };
    let q;
    if (state.queries[item.name])
      q = await api("/api/queries/" + state.queries[item.name], "POST", body);
    else {
      q = await api("/api/queries", "POST", body);
      state.queries[item.name] = q.id;
      save();
    }
    // Run each query once so a created widget cannot be mistaken for a working
    // connection. Do not print result rows, credentials or provider errors.
    let result = await api("/api/queries/" + q.id + "/results", "POST", {
      max_age: 0,
      parameters: {},
    });
    for (
      let attempt = 0;
      result.job && [1, 2].includes(result.job.status) && attempt < 30;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await api("/api/jobs/" + result.job.id);
    }
    if (!result.query_result && result.job?.status !== 3)
      throw new Error("QUERY_EXECUTION_FAILED");
    if (!state.widgets[item.name]) {
      const visualization = q.visualizations?.find((v) => v.type === "TABLE");
      if (!visualization) throw new Error("QUERY_VISUALIZATION_MISSING");
      const widget = await api("/api/widgets", "POST", {
        dashboard_id: state.dashboardId,
        visualization_id: visualization.id,
        options: {
          position: {
            col: (i % 2) * 6,
            row: Math.floor(i / 2) * 8,
            sizeX: 6,
            sizeY: 8,
          },
          parameterMappings: {},
        },
      });
      state.widgets[item.name] = widget.id;
      save();
    }
  }
  // Publishing within the authenticated organization is separate from public
  // sharing. Never enable a dashboard public link or public query API URL.
  await api("/api/dashboards/" + state.dashboardId, "POST", {
    name: "Algostep 비즈니스 분석",
    is_draft: false,
  });
  console.log(
    "Dashboard ready: " + origin + "/dashboard/" + state.dashboardSlug,
  );
} catch (e) {
  // Fetch errors may retain authentication headers; do not print the object.
  console.error(
    "Redash setup incomplete. " +
      (/^REDASH_HTTP_\d+$/.test(e.message)
        ? e.message
        : "Check connectivity, API permissions, data source test and the saved state."),
  );
  process.exitCode = 1;
}
