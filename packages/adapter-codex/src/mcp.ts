import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ChangeSetStore } from "@domtune/transport";
import { buildPanelHtml, TUNER_URI } from "./ui.js";

export function createDomTuneMcp(store: ChangeSetStore, baseUrl: string): McpServer {
  const server = new McpServer({ name: "domtune", version: "0.1.0" });

  server.registerResource(
    "domtune-panel",
    TUNER_URI,
    {
      title: "DOMTune",
      description: "Review captured page adjustments and continue the current conversation.",
      mimeType: "text/html;profile=mcp-app"
    },
    async () => ({
      contents: [
        {
          uri: TUNER_URI,
          mimeType: "text/html;profile=mcp-app",
          text: buildPanelHtml(baseUrl),
          _meta: {
            ui: {
              prefersBorder: false,
              csp: { connectDomains: [baseUrl, "http://localhost:47822"] }
            },
            "openai/widgetCSP": {
              connect_domains: [baseUrl, "http://localhost:47822"],
              resource_domains: []
            }
          }
        }
      ]
    })
  );

  server.registerTool(
    "open_domtune",
    {
      title: "Open DOMTune",
      description: "Open the DOMTune bridge for the current conversation and create a page-adjustment session. Pass the absolute current workspace and target development URL when available.",
      inputSchema: {
        workspace: z.string().optional(),
        targetUrl: z.string().url().optional()
      },
      outputSchema: {
        sessionId: z.string(),
        overlayUrl: z.string(),
        demoUrl: z.string(),
        panelPreviewUrl: z.string(),
        apiBaseUrl: z.string(),
        workspace: z.string()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        ui: { resourceUri: TUNER_URI },
        "openai/outputTemplate": TUNER_URI
      }
    },
    async ({ workspace, targetUrl }) => {
      const sessionId = `dt_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
      const overlayUrl = new URL(targetUrl ?? "http://127.0.0.1:4174/");
      overlayUrl.searchParams.set("domTuneSession", sessionId);
      const structuredContent = {
        sessionId,
        overlayUrl: overlayUrl.toString(),
        demoUrl: `${baseUrl}/demo?session=${sessionId}`,
        panelPreviewUrl: `${baseUrl}/panel-preview?session=${sessionId}`,
        apiBaseUrl: baseUrl,
        workspace: workspace ?? "."
      };
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `DOMTune session ${sessionId} is ready. Open ${structuredContent.overlayUrl} to tune the real application DOM; the embedded panel will bridge submitted ChangeSets back to this conversation.`
          }
        ]
      };
    }
  );

  server.registerTool(
    "list_domtune_change_sets",
    {
      title: "List Visual ChangeSets",
      description: "List captured visual ChangeSets, optionally limited to one DOMTune session.",
      inputSchema: { sessionId: z.string().optional() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        ui: { visibility: ["model", "app"] },
        "openai/widgetAccessible": true
      }
    },
    async ({ sessionId }) => {
      const items = await store.list(sessionId);
      return {
        structuredContent: { items },
        content: [{ type: "text", text: JSON.stringify(items, null, 2) }]
      };
    }
  );

  server.registerTool(
    "save_domtune_change_set",
    {
      title: "Save Visual ChangeSet",
      description: "Save one source-mapped visual adjustment set from the DOMTune app.",
      inputSchema: {
        sessionId: z.string().min(1),
        origin: z.enum(["embedded", "browser-overlay"]).optional(),
        workspace: z.string().min(1),
        pageUrl: z.string().min(1),
        viewport: z.object({ width: z.number(), height: z.number() }),
        target: z.object({
          selector: z.string().min(1),
          label: z.string().min(1),
          source: z.object({ file: z.string().min(1), line: z.number().int().positive() })
        }),
        changes: z.array(
          z.object({ property: z.string().min(1), before: z.string(), after: z.string() })
        ).min(1)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
        "openai/visibility": "private"
      }
    },
    async (input) => {
      const item = await store.create(input);
      return {
        structuredContent: { item },
        content: [{ type: "text", text: `Saved DOMTune ChangeSet ${item.id}.` }]
      };
    }
  );

  server.registerTool(
    "mark_domtune_change_set_notified",
    {
      title: "Mark Visual ChangeSet Notified",
      description: "Record that the conversation bridge sent the ChangeSet follow-up message.",
      inputSchema: { changeSetId: z.string().min(1) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
        "openai/visibility": "private"
      }
    },
    async ({ changeSetId }) => {
      const item = await store.markConversationNotified(changeSetId);
      if (!item) {
        return { isError: true, content: [{ type: "text", text: `ChangeSet ${changeSetId} was not found.` }] };
      }
      return {
        structuredContent: { item },
        content: [{ type: "text", text: `Marked ${changeSetId} as sent to the conversation.` }]
      };
    }
  );

  server.registerTool(
    "get_domtune_change_set",
    {
      title: "Get Visual ChangeSet",
      description: "Read one captured visual ChangeSet before applying it to source code.",
      inputSchema: { changeSetId: z.string().min(1) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ changeSetId }) => {
      const item = await store.get(changeSetId);
      if (!item) {
        return { isError: true, content: [{ type: "text", text: `ChangeSet ${changeSetId} was not found.` }] };
      }
      return {
        structuredContent: JSON.parse(JSON.stringify(item)) as Record<string, unknown>,
        content: [{ type: "text", text: JSON.stringify(item, null, 2) }]
      };
    }
  );

  server.registerTool(
    "report_domtune_change_result",
    {
      title: "Report Visual Change Result",
      description: "Report whether a DOMTune ChangeSet was applied and record verification evidence.",
      inputSchema: {
        changeSetId: z.string().min(1),
        status: z.enum(["applied", "failed"]),
        summary: z.string().min(1),
        changedFiles: z.array(z.string()).default([]),
        verification: z.array(z.string()).default([])
      }
    },
    async ({ changeSetId, status, summary, changedFiles, verification }) => {
      const item = await store.report(changeSetId, status, { summary, changedFiles, verification });
      if (!item) {
        return { isError: true, content: [{ type: "text", text: `ChangeSet ${changeSetId} was not found.` }] };
      }
      return {
        structuredContent: JSON.parse(JSON.stringify(item)) as Record<string, unknown>,
        content: [{ type: "text", text: `Recorded ${status} for ${changeSetId}: ${summary}` }]
      };
    }
  );

  return server;
}
