import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { buildSessionPanelHtml } from "../src/session-panel.js";

test("the embedded panel is a compact session bridge", () => {
  const html = buildSessionPanelHtml("http://127.0.0.1:49999");

  assert.doesNotMatch(html, /fetch\(/);
  assert.doesNotMatch(html, /apiBaseUrl/);
  assert.match(html, /Adjust in the controlled browser/);
  assert.match(html, /continue automatically/);
  assert.match(html, /await ensureStandardHost\(\);/);
  assert.match(html, /ui\/notifications\/initialized/);
  assert.match(html, /Connection interrupted\. Retrying/);
  assert.match(html, /wait_for_domtune_change_set/);
  assert.match(html, /sendFollowUpMessage/);
  assert.match(html, /"openai\/message": \{ target: "active", send: true \}/);
  assert.match(html, /visibilitychange/);
  assert.match(html, /release_domtune_change_set_claim/);
  assert.match(html, /mark_domtune_change_set_notified/);
  assert.match(html, /claimed\.conversationClaimedAt/);
  assert.match(html, /DOMTune 已附上 1 个元素的执行上下文/);
  assert.doesNotMatch(html, /<details>|<summary>/);
  assert.doesNotMatch(html, /无需再按 ID 查询/);
  assert.match(html, /agentPayload/);
  assert.match(html, /JSON\.stringify\(agentPayload \|\| item\)/);
  assert.doesNotMatch(html, /Save and apply in Codex/);
  assert.doesNotMatch(html, /Weekly overview/);
  assert.match(html, /item\.prompt/);
  assert.match(html, /item\.targets/);
  assert.match(html, /item\.pageUrl/);
  assert.match(html, /target\.prompt/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});

test("the session bridge completes the MCP Apps handshake before polling", async () => {
  const html = buildSessionPanelHtml();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);

  const calls: string[] = [];
  const elements = new Map<string, { textContent: string; className: string; dataset: Record<string, string> }>();
  const element = (id: string) => {
    const existing = elements.get(id);
    if (existing) return existing;
    const created = { textContent: "", className: "", dataset: {} };
    elements.set(id, created);
    return created;
  };
  let messageListener: ((event: { source: unknown; data: unknown }) => void) | undefined;
  const parent = {
    postMessage(message: { id?: number; method?: string }) {
      calls.push(message.method ?? "unknown");
      if (message.method === "ui/initialize" && message.id !== undefined) {
        queueMicrotask(() => messageListener?.({
          source: parent,
          data: {
            jsonrpc: "2.0",
            id: message.id,
            result: { protocolVersion: "2026-01-26", hostCapabilities: {}, hostInfo: {}, hostContext: {} }
          }
        }));
      }
    }
  };
  const windowObject = {
    parent,
    openai: {
      toolOutput: { sessionId: "session-test", workspace: "/workspace", overlayUrl: "http://127.0.0.1:4173/" },
      async callTool(name: string) {
        calls.push(`tool:${name}`);
        return { structuredContent: { timedOut: true } };
      }
    },
    addEventListener(type: string, listener: typeof messageListener) {
      if (type === "message") messageListener = listener;
    }
  };

  runInNewContext(script, {
    window: windowObject,
    document: { getElementById: element, hidden: false, addEventListener: () => undefined },
    location: { search: "" },
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => undefined,
    queueMicrotask,
    console
  });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(calls.slice(0, 3), [
    "ui/initialize",
    "ui/notifications/initialized",
    "tool:wait_for_domtune_change_set"
  ]);
  assert.equal(elements.get("error")?.textContent, "");
});
