import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createProject, listProjects } from "./provision";
import { config } from "./config";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "hold-control-plane" }));

app.get("/v1/projects", async (c) => c.json(await listProjects()));

app.post("/v1/projects", async (c) => {
  const body = await c.req.json().catch(() => ({}) as { name?: string });
  if (!body?.name) return c.json({ error: "name required" }, 400);
  try {
    const res = await createProject(body.name);
    return c.json(res, 201);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

serve({ fetch: app.fetch, port: config.apiPort });
console.log(`hold control-plane listening on :${config.apiPort}`);
