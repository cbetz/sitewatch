import { Hono } from "hono";
import { createProductionApp } from "./env.js";

// Vercel's Hono preset picks as entrypoint the file that imports hono and
// default-exports an app, so the wiring is mounted here explicitly.
const app = new Hono();
app.route("/", createProductionApp());

export default app;
