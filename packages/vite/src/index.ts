import { buildOverlayClient } from "@domtune/overlay";
import type { Plugin } from "vite";

export interface DomTunePluginOptions {
  bridgeUrl?: string;
  workspace?: string;
}

const CLIENT_PATH = "/@domtune/client.js";

export function domTunePlugin(options: DomTunePluginOptions = {}): Plugin {
  const clientUrl = `${CLIENT_PATH}?v=${Date.now().toString(36)}`;
  const config = {
    bridgeUrl: options.bridgeUrl ?? "http://127.0.0.1:47822",
    workspace: options.workspace ?? process.cwd()
  };

  return {
    name: "domtune-overlay",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(CLIENT_PATH, (_req, res) => {
        res.setHeader("content-type", "text/javascript; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(buildOverlayClient(config));
      });
    },
    transformIndexHtml() {
      return [{ tag: "script", attrs: { type: "module", src: clientUrl }, injectTo: "body" }];
    }
  };
}
