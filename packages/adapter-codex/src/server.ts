import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { newChangeSetSchema } from "@domtune/core";
import { ChangeSetStore } from "@domtune/transport";
import { ChromiumBrowserSessionLauncher } from "@domtune/browser";
import { createDomTuneMcp } from "./mcp.js";
import { buildDemoHtml, buildPanelHtml } from "./ui.js";

export const port = Number(process.env.DOMTUNE_PORT ?? 47822);
export const host = "127.0.0.1";
export const baseUrl = `http://${host}:${port}`;
export const projectRoot = resolve(process.env.DOMTUNE_ROOT ?? process.cwd());
export const dataRoot = resolve(process.env.PLUGIN_DATA ?? projectRoot);
export const store = new ChangeSetStore(resolve(dataRoot, ".domtune/change-sets.json"));
export const browserLauncher = new ChromiumBrowserSessionLauncher({ dataRoot });
const app = createMcpExpressApp({ host });
const browserSourceRequestSchema = z.object({
  sessionId: z.string().min(1),
  targetToken: z.string().regex(/^[A-Za-z0-9_-]+$/),
  properties: z.array(z.enum(["padding", "border-radius", "font-size", "background-color"])).min(1)
});

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, mcp-session-id");
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("access-control-allow-private-network", "true");
  res.setHeader("access-control-expose-headers", "mcp-session-id");
  res.setHeader("cross-origin-resource-policy", "cross-origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "domtune" });
});

app.get("/demo", (_req: Request, res: Response) => {
  res.type("html").send(buildDemoHtml(projectRoot));
});

app.get("/demo.css", async (_req: Request, res: Response) => {
  res.type("css").send(await readFile(resolve(projectRoot, "examples/embedded-demo/styles.css"), "utf8"));
});

app.get("/panel-preview", (_req: Request, res: Response) => {
  res.type("html").send(buildPanelHtml(baseUrl));
});

app.get("/api/change-sets", async (req: Request, res: Response) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  res.json(await store.list(sessionId));
});

app.get("/api/change-sets/:id", async (req: Request, res: Response) => {
  const item = await store.get(String(req.params.id));
  if (!item) return res.status(404).json({ error: "ChangeSet not found" });
  res.json(item);
});

app.post("/api/change-sets", async (req: Request, res: Response) => {
  const parsed = newChangeSetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const item = await store.create(parsed.data);
  res.status(201).json(item);
});

app.post("/api/source-map", async (req: Request, res: Response) => {
  const parsed = browserSourceRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const result = await browserLauncher.resolveSource(parsed.data);
  if (result.reason === "session-not-found" || result.reason === "target-not-found") return res.status(404).json(result);
  res.json(result);
});

app.post("/mcp", async (req: Request, res: Response) => {
  const server = createDomTuneMcp(store, baseUrl, browserLauncher);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  } finally {
    res.on("close", () => {
      transport.close();
      server.close();
    });
  }
});

app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
});

app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
});

export function startDomTuneWebServer(log: (message: string) => void = console.log) {
  const listener = app.listen(port, host, () => {
    log(`DOMTune demo:     ${baseUrl}/demo?session=local-demo`);
    log(`Panel preview:    ${baseUrl}/panel-preview?session=local-demo`);
    log(`MCP endpoint:     ${baseUrl}/mcp`);
  });

  listener.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      log(`DOMTune web server is already available at ${baseUrl}.`);
      return;
    }
    throw error;
  });

  return listener;
}

