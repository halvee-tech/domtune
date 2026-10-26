import { fileURLToPath } from "node:url";
import { domTunePlugin } from "@domtune/vite";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { host: "127.0.0.1", port: 4174 },
  css: { devSourcemap: true },
  plugins: [domTunePlugin({ workspace: projectRoot })]
});
