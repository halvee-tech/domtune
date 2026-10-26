import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDomTuneMcp } from "./mcp.js";
import { baseUrl, browserLauncher, startDomTuneWebServer, store } from "./server.js";

async function main(): Promise<void> {
  startDomTuneWebServer((message) => console.error(message));
  const server = createDomTuneMcp(store, baseUrl, browserLauncher);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
