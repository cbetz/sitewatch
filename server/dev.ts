import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createProductionApp } from "./src/env.js";

// Minimal .env loader so local dev needs no extra tooling.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && match[1] && !(match[1] in process.env)) process.env[match[1]] = match[2] ?? "";
  }
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createProductionApp().fetch, port });
console.log(`sitewatch server listening on http://localhost:${port}/api/health`);
