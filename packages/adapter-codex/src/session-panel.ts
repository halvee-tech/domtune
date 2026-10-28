import { LATEST_PROTOCOL_VERSION as MCP_APPS_PROTOCOL_VERSION } from "@modelcontextprotocol/ext-apps";

export function buildSessionPanelHtml(baseUrl = "http://127.0.0.1:47822"): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0d1016; color: #f4f6fb; }
    main { display: grid; gap: 14px; padding: 16px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .brand { display: grid; gap: 3px; }
    .eyebrow { margin: 0; color: #8f98aa; font: 700 9px/1.2 ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
    .status { display: inline-flex; align-items: center; gap: 7px; color: #bdc5d3; font-size: 11px; }
    .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #70dda4; box-shadow: 0 0 0 4px rgb(112 221 164 / 10%); }
    .session { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    .detail { min-width: 0; border: 1px solid #292f3a; border-radius: 9px; padding: 10px 11px; background: #141821; }
    .detail span { display: block; margin-bottom: 4px; color: #858fa2; font-size: 9px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
    .detail code { display: block; overflow: hidden; color: #dce3ef; font: 10px/1.35 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
    .handoff { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 11px; border: 1px solid #29313b; border-radius: 10px; padding: 12px; background: #11161d; }
    .icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: #183226; color: #70dda4; font-size: 17px; }
    .copy { min-width: 0; }
    .copy strong { display: block; margin-bottom: 3px; font-size: 12px; }
    .copy p { margin: 0; color: #98a2b3; font-size: 11px; line-height: 1.4; }
    .badge { border-radius: 999px; padding: 5px 8px; background: #202631; color: #aeb7c7; font-size: 9px; white-space: nowrap; }
    .badge.ready { background: #173326; color: #81e6ad; }
    .request { display: none; border-top: 1px solid #242a34; padding-top: 12px; }
    .request[data-visible="true"] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; }
    .request strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .request span { color: #8f98aa; font-size: 10px; }
    .request code { color: #70dda4; font: 10px/1.3 ui-monospace, monospace; }
    .error { margin: 0; color: #ff9c9c; font-size: 10px; }
    @media (max-width: 560px) { .session { grid-template-columns: 1fr; } .handoff { grid-template-columns: 32px minmax(0, 1fr); } .badge { grid-column: 2; justify-self: start; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand"><p class="eyebrow">Current conversation</p><h1>DOMTune</h1></div>
      <span class="status">Browser connected</span>
    </header>
    <section class="session" aria-label="DOMTune session details">
      <div class="detail"><span>Page</span><code id="page">Waiting for target…</code></div>
      <div class="detail"><span>Workspace</span><code id="workspace">—</code></div>
    </section>
    <section class="handoff" aria-live="polite">
      <span class="icon" aria-hidden="true">↗</span>
      <div class="copy"><strong id="title">Adjust in the controlled browser</strong><p id="message">Select elements there, then click Send to Agent. This conversation will continue automatically.</p></div>
      <span id="badge" class="badge">Waiting</span>
    </section>
    <section id="request" class="request"><strong id="prompt"></strong><code id="requestId"></code><span id="meta"></span></section>
    <p id="error" class="error" role="alert"></p>
  </main>
  <script>
    const qs = new URLSearchParams(location.search);
    const toolOutput = window.openai?.toolOutput ?? {};
    const sessionId = toolOutput.sessionId ?? qs.get("session") ?? "local-demo";
    let nextRequestId = 1;
    let standardHostReady = null;
    let polling = false;
    let pollTimer = null;
    const pending = new Map();
    const delivered = new Set();
    document.getElementById("page").textContent = toolOutput.overlayUrl ?? "Session " + sessionId;
    document.getElementById("workspace").textContent = toolOutput.workspace ?? "—";

    function hostRequest(method, params) {
      const id = nextRequestId++;
      window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("The conversation bridge did not respond."));
        }, 8000);
        pending.set(id, { resolve, reject, timer });
      });
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0" || message.id === undefined) return;
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      clearTimeout(handler.timer);
      message.error ? handler.reject(message.error) : handler.resolve(message.result);
    });

    function ensureStandardHost() {
      if (standardHostReady) return standardHostReady;
      standardHostReady = hostRequest("ui/initialize", {
        appInfo: { name: "domtune", version: "0.1.0" },
        appCapabilities: {},
        protocolVersion: ${JSON.stringify(MCP_APPS_PROTOCOL_VERSION)}
      }).then((result) => {
        window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} }, "*");
        return result;
      }).catch((error) => {
        standardHostReady = null;
        throw error;
      });
      return standardHostReady;
    }

    async function callMcpTool(name, args) {
      if (window.openai?.callTool) return window.openai.callTool(name, args);
      if (window.parent !== window) {
        await ensureStandardHost();
        return hostRequest("tools/call", { name, arguments: args });
      }
      return null;
    }

    async function continueConversation(prompt) {
      if (window.openai?.sendFollowUpMessage) {
        await window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
      } else if (window.parent !== window) {
        await ensureStandardHost();
        await hostRequest("ui/message", {
          role: "user",
          content: [{ type: "text", text: prompt }],
          _meta: { "openai/message": { target: "active", send: true } }
        });
      } else {
        throw new Error("Conversation messaging is unavailable.");
      }
    }

    function structuredResult(result) {
      return result?.structuredContent ?? result?.structured_content ?? {};
    }

    function conversationPrompt(item, agentPayload) {
      const targetCount = item.targets?.length || 1;
      const prompts = [item.prompt, ...(item.targets ?? [item.target]).map((target) => target.prompt)]
        .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
      const instruction = prompts.length
        ? prompts.join("\\n")
        : "请应用我刚刚在 DOMTune 中完成的页面调整。";
      return [
        instruction,
        "",
        targetCount === 1 ? "DOMTune 已附上 1 个元素的执行上下文。" : "DOMTune 已附上 " + targetCount + " 个元素的执行上下文。",
        "",
        "\`\`\`json",
        JSON.stringify(agentPayload || item),
        "\`\`\`"
      ].join("\\n");
    }

    function render(item) {
      if (!item) return;
      const targets = item.targets?.length || 1;
      const prompt = item.prompt || item.targets?.find((target) => target.prompt)?.prompt || "DOMTune changes ready";
      document.getElementById("title").textContent = item.conversationNotifiedAt ? "Sent to the agent" : "ChangeSet received";
      document.getElementById("message").textContent = item.conversationNotifiedAt
        ? "The agent is continuing this conversation and applying the request."
        : "The request is being handed back to the current conversation.";
      const badge = document.getElementById("badge");
      badge.className = "badge ready";
      badge.textContent = item.conversationNotifiedAt ? "Continuing" : "Ready";
      const request = document.getElementById("request");
      request.dataset.visible = "true";
      document.getElementById("prompt").textContent = prompt;
      document.getElementById("requestId").textContent = item.id;
      document.getElementById("meta").textContent = targets + (targets === 1 ? " selected element" : " selected elements") + " · " + item.pageUrl;
    }

    async function refresh() {
      if (polling) return;
      polling = true;
      try {
        await ensureStandardHost();
        const claimResult = await callMcpTool("wait_for_domtune_change_set", { sessionId, timeoutMs: 1000 });
        const claimData = structuredResult(claimResult);
        const claimed = claimData.item;
        if (claimed && !delivered.has(claimed.id)) {
          delivered.add(claimed.id);
          render(claimed);
          try {
            await continueConversation(conversationPrompt(claimed, claimData.agentPayload));
          } catch (error) {
            delivered.delete(claimed.id);
            await callMcpTool("release_domtune_change_set_claim", {
              changeSetId: claimed.id,
              claimedAt: claimed.conversationClaimedAt
            });
            throw error;
          }
          try {
            const deliveredResult = await callMcpTool("mark_domtune_change_set_notified", { changeSetId: claimed.id });
            const deliveredItem = structuredResult(deliveredResult).item;
            if (deliveredItem) render(deliveredItem);
          } catch (error) {
            document.getElementById("error").textContent = "Request sent; status sync is retrying… " + error.message;
          }
          document.getElementById("title").textContent = "Sent to the agent";
          document.getElementById("message").textContent = "A new turn has started in this conversation with the complete request.";
          document.getElementById("badge").textContent = "Continuing";
          document.getElementById("error").textContent = "";
          return;
        }
        document.getElementById("error").textContent = "";
      } catch (error) {
        document.getElementById("error").textContent = "Connection interrupted. Retrying… " + error.message;
      } finally {
        polling = false;
      }
    }

    async function start() {
      await refresh();
      pollTimer = setInterval(refresh, 1500);
    }

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refresh();
    });

    window.addEventListener("pagehide", () => {
      if (pollTimer) clearInterval(pollTimer);
      for (const handler of pending.values()) {
        clearTimeout(handler.timer);
        handler.reject(new Error("The conversation bridge was closed."));
      }
      pending.clear();
    }, { once: true });

    void start();
  </script>
</body>
</html>`;
}
