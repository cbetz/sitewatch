import { handle } from "hono/vercel";
import { createProductionApp } from "../src/env.js";

const app = createProductionApp();

export default handle(app);
