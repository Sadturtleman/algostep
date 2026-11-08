import { writeFile } from "node:fs/promises";
import { openapi } from "../apps/server/src/openapi.js";
await writeFile(
  new URL("../docs/openapi.json", import.meta.url),
  JSON.stringify(openapi, null, 2) + "\n",
);
console.log("Exported docs/openapi.json");
