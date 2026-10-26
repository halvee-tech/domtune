import { LATEST_PROTOCOL_VERSION as MCP_APPS_PROTOCOL_VERSION } from "@modelcontextprotocol/ext-apps";

export const TUNER_URI = "ui://domtune/panel-v1.html";

export function buildPanelHtml(baseUrl = "http://127.0.0.1:47822"): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0d12; color: #f4f6fb; }
    main { min-height: 100vh; padding: 20px; display: grid; align-content: start; gap: 16px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h1 { margin: 0; font-size: 18px; letter-spacing: -0.02em; }
    .eyebrow { margin: 0 0 4px; color: #8d96aa; font: 600 11px/1.2 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; }
    .status { display: inline-flex; align-items: center; gap: 7px; color: #aeb6c8; font-size: 12px; }
    .status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #697386; }
    .status.ready::before { background: #72e0a5; box-shadow: 0 0 0 4px rgb(114 224 165 / 10%); }
    .editor { display: grid; grid-template-columns: minmax(220px, .9fr) minmax(260px, 1.1fr); gap: 14px; }
    .preview { min-height: 250px; border-radius: 14px; padding: 24px; background: #dfe6dc; color: #101713; display: grid; align-content: center; gap: 20px; overflow: hidden; }
    .preview p { margin: 0; color: #66746c; font: 700 10px/1.2 ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; }
    .preview h2 { margin: 0; font-size: 36px; line-height: .95; letter-spacing: -.06em; }
    .metric { padding: 24px; border-radius: 18px; background: #f3f5ef; box-shadow: 0 18px 38px rgb(25 44 34 / 10%); }
    .metric strong { display: block; margin: 14px 0 3px; font-size: 38px; letter-spacing: -.05em; }
    .metric span { color: #1d7a4b; font-size: 12px; font-weight: 700; }
    .controls { display: grid; align-content: start; gap: 14px; border: 1px solid #262b36; background: #11141b; border-radius: 14px; padding: 16px; }
    label { display: grid; grid-template-columns: 1fr auto; gap: 7px 12px; color: #c5ccda; font-size: 12px; }
    label output { color: #f4f6fb; font: 600 12px/1 ui-monospace, monospace; }
    input[type="range"] { grid-column: 1 / -1; width: 100%; accent-color: #72e0a5; }
    input[type="color"] { width: 42px; height: 32px; border: 1px solid #343a47; border-radius: 8px; padding: 3px; background: #0b0d12; }
    .card { border: 1px solid #262b36; background: #11141b; border-radius: 14px; padding: 16px; }
    .empty { color: #8d96aa; font-size: 13px; line-height: 1.55; }
    dl { display: grid; grid-template-columns: 1fr auto; gap: 10px 16px; margin: 0; font-size: 13px; }
    dt { color: #8d96aa; }
    dd { margin: 0; font-family: ui-monospace, monospace; }
    .changes { margin: 14px 0 0; padding: 0; list-style: none; border-top: 1px solid #262b36; }
    .changes li { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 10px 0; border-bottom: 1px solid #1e222c; font-size: 12px; }
    .changes code { color: #72e0a5; }
    button { min-height: 44px; border: 0; border-radius: 10px; padding: 0 16px; background: #72e0a5; color: #07140d; font: 700 13px/1 system-ui; cursor: pointer; transition: transform 150ms ease, background 150ms ease; }
    button:hover { background: #8beab5; }
    button:active { transform: translateY(1px); }
    button:focus-visible { outline: 3px solid #a7b8ff; outline-offset: 3px; }
    button:disabled { cursor: not-allowed; opacity: .45; }
    .error { color: #ff9a9a; font-size: 12px; }
    .feedback { min-height: 18px; margin: 0; color: #aeb6c8; font-size: 12px; line-height: 1.45; }
    @media (max-width: 620px) { .editor { grid-template-columns: 1fr; } .preview { min-height: 210px; } }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><p class="eyebrow">Current conversation</p><h1>DOMTune</h1></div>
      <span id="status" class="status">Waiting</span>
    </header>
    <section class="editor" aria-label="Visual adjustment editor">
      <div class="preview">
        <div><p>Weekly overview</p><h2 id="previewHeading">Move with clarity.</h2></div>
        <article id="previewMetric" class="metric"><p>Activation rate</p><strong>68.4%</strong><span>+8.2% this week</span></article>
      </div>
      <div class="controls">
        <label>Padding <output id="paddingOut">24px</output><input id="padding" type="range" min="12" max="48" value="24" /></label>
        <label>Corner radius <output id="radiusOut">18px</output><input id="radius" type="range" min="0" max="32" value="18" /></label>
        <label>Heading size <output id="fontOut">48px</output><input id="font" type="range" min="32" max="72" value="48" /></label>
        <label>Surface <input id="color" type="color" value="#f3f5ef" /></label>
        <button id="saveApply" type="button">Save and apply in Codex</button>
        <p id="feedback" class="feedback" role="status">Adjust values, then send one scoped ChangeSet to this conversation.</p>
      </div>
    </section>
    <section id="content" class="card empty">No ChangeSet sent yet.</section>
    <div id="error" class="error" role="alert"></div>
  </main>
  <script>
    const qs = new URLSearchParams(location.search);
    const toolOutput = window.openai?.toolOutput ?? {};
    const sessionId = toolOutput.sessionId ?? qs.get("session") ?? "local-demo";
    const apiBaseUrl = toolOutput.apiBaseUrl ?? qs.get("apiBaseUrl") ?? ${JSON.stringify(baseUrl)};
    const workspace = toolOutput.workspace ?? ".";
    const statusEl = document.getElementById("status");
    const contentEl = document.getElementById("content");
    const saveApplyEl = document.getElementById("saveApply");
    const feedbackEl = document.getElementById("feedback");
    const errorEl = document.getElementById("error");
    let latest = null;
    let nextRequestId = 1;
    const pending = new Map();
    const notifiedLocally = new Set();
    let standardHostReady = null;

    function hostRequest(method, params) {
      const id = nextRequestId++;
      window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0" || message.id === undefined) return;
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
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

    function structuredResult(result) {
      return result?.structuredContent ?? result?.structured_content ?? {};
    }

    function render(item) {
      latest = item;
      if (!item) {
        statusEl.className = "status";
        statusEl.textContent = "Waiting";
        contentEl.className = "card empty";
        contentEl.textContent = "No ChangeSet sent yet.";
        return;
      }
      statusEl.className = "status ready";
      statusEl.textContent = item.status === "pending" ? "Ready" : item.status;
      contentEl.className = "card";
      contentEl.innerHTML =
        "<dl><dt>ChangeSet</dt><dd>" + item.id +
        "</dd><dt>Target</dt><dd>" + item.target.label +
        "</dd><dt>Viewport</dt><dd>" + item.viewport.width + "×" + item.viewport.height +
        "</dd></dl><ul class='changes'>" +
        item.changes.map((change) =>
          "<li><span>" + change.property + "</span><code>" + change.before + " → " + change.after + "</code></li>"
        ).join("") + "</ul>";
    }

    const controls = {
      padding: document.getElementById("padding"),
      radius: document.getElementById("radius"),
      font: document.getElementById("font"),
      color: document.getElementById("color")
    };
    const baseline = { padding: "24px", radius: "18px", font: "48px", color: "#f3f5ef" };

    function updatePreview() {
      document.getElementById("previewMetric").style.padding = controls.padding.value + "px";
      document.getElementById("previewMetric").style.borderRadius = controls.radius.value + "px";
      document.getElementById("previewMetric").style.backgroundColor = controls.color.value;
      document.getElementById("previewHeading").style.fontSize = controls.font.value + "px";
      document.getElementById("paddingOut").textContent = controls.padding.value + "px";
      document.getElementById("radiusOut").textContent = controls.radius.value + "px";
      document.getElementById("fontOut").textContent = controls.font.value + "px";
    }
    Object.values(controls).forEach((control) => control.addEventListener("input", updatePreview));
    updatePreview();

    async function refresh() {
      try {
        const toolResult = await callMcpTool("list_domtune_change_sets", { sessionId });
        if (toolResult) {
          const item = structuredResult(toolResult).items?.[0] ?? null;
          render(item);
          errorEl.textContent = "";
          if (
            item?.origin === "browser-overlay" &&
            item.status === "pending" &&
            !item.conversationNotifiedAt &&
            !notifiedLocally.has(item.id)
          ) {
            notifiedLocally.add(item.id);
            const prompt = "Use $apply-domtune to apply DOMTune ChangeSet " + item.id + ". Preserve unaffected viewports, verify the result, and report it with report_domtune_change_result.";
            await continueConversation(prompt);
            await callMcpTool("mark_domtune_change_set_notified", { changeSetId: item.id });
            feedbackEl.textContent = "Browser adjustment " + item.id + " sent to this conversation.";
          }
          return;
        }
        const response = await fetch(apiBaseUrl + "/api/change-sets?sessionId=" + encodeURIComponent(sessionId));
        if (!response.ok) throw new Error("HTTP " + response.status);
        const items = await response.json();
        render(items[0] ?? null);
        errorEl.textContent = "";
      } catch (error) {
        errorEl.textContent = "Could not read ChangeSets: " + error.message;
      }
    }

    async function continueConversation(prompt) {
      if (window.openai?.sendFollowUpMessage) {
        await window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
      } else if (window.parent !== window) {
        await ensureStandardHost();
        await hostRequest("ui/message", { role: "user", content: [{ type: "text", text: prompt }] });
      } else {
        contentEl.insertAdjacentHTML("beforeend", "<p class='empty'><strong>Local preview:</strong> " + prompt + "</p>");
      }
    }

    saveApplyEl.addEventListener("click", async () => {
      const changes = [
        ["padding", baseline.padding, controls.padding.value + "px"],
        ["border-radius", baseline.radius, controls.radius.value + "px"],
        ["font-size", baseline.font, controls.font.value + "px"],
        ["background-color", baseline.color, controls.color.value]
      ].filter(([, previous, next]) => previous !== next)
       .map(([property, previous, next]) => ({ property, before: previous, after: next }));
      if (!changes.length) {
        errorEl.textContent = "Adjust at least one value before sending.";
        return;
      }
      saveApplyEl.disabled = true;
      saveApplyEl.textContent = "Sending…";
      errorEl.textContent = "";
      try {
        const input = {
          sessionId,
          origin: "embedded",
          workspace,
          pageUrl: toolOutput.demoUrl ?? apiBaseUrl + "/demo?session=" + encodeURIComponent(sessionId),
          viewport: { width: innerWidth, height: innerHeight },
          target: { selector: ".metric-card", label: "Metric card", source: { file: "examples/embedded-demo/styles.css", line: 46 } },
          changes
        };
        const toolResult = await callMcpTool("save_domtune_change_set", input);
        let item = structuredResult(toolResult).item;
        if (!item) {
          const response = await fetch(apiBaseUrl + "/api/change-sets", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input)
          });
          item = await response.json();
          if (!response.ok) throw new Error(item.error ?? ("HTTP " + response.status));
        }
        render(item);
        const prompt = "Use $apply-domtune to apply DOMTune ChangeSet " + item.id + ". Preserve unaffected viewports, verify the result, and report it with report_domtune_change_result.";
        await continueConversation(prompt);
        notifiedLocally.add(item.id);
        await callMcpTool("mark_domtune_change_set_notified", { changeSetId: item.id });
        feedbackEl.textContent = "Sent " + item.id + " to this conversation.";
        saveApplyEl.textContent = "Sent to Codex";
      } catch (error) {
        saveApplyEl.disabled = false;
        saveApplyEl.textContent = "Save and apply in Codex";
        errorEl.textContent = "Could not continue this conversation: " + error.message;
      }
    });

    refresh();
    setInterval(refresh, 1500);
  </script>
</body>
</html>`;
}

export function buildDemoHtml(workspace: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/demo.css" />
</head>
<body>
  <main class="demo-shell">
    <section class="canvas" aria-label="Demo page preview">
      <nav><span class="logo">Northstar</span><button class="quiet">Share</button></nav>
      <div class="hero"><p>Weekly overview</p><h1>Move with clarity.</h1></div>
      <article class="metric-card" data-visual-target data-source="examples/embedded-demo/styles.css:46">
        <p class="metric-label">Activation rate</p><strong>68.4%</strong><span>+8.2% this week</span>
      </article>
    </section>
    <aside class="inspector">
      <div><p class="eyebrow">Selected</p><h2>Metric card</h2></div>
      <label>Padding <output id="paddingOut">24px</output><input id="padding" type="range" min="12" max="48" value="24" /></label>
      <label>Corner radius <output id="radiusOut">18px</output><input id="radius" type="range" min="0" max="32" value="18" /></label>
      <label>Heading size <output id="fontOut">48px</output><input id="font" type="range" min="32" max="72" value="48" /></label>
      <label>Surface <input id="color" type="color" value="#f3f5ef" /></label>
      <button id="save" class="primary" type="button">Save draft ChangeSet</button>
      <p id="feedback" class="feedback" role="status">Preview only · Session: <code id="session"></code></p>
    </aside>
  </main>
  <script>
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session") ?? "local-demo";
    const card = document.querySelector("[data-visual-target]");
    const heroTitle = document.querySelector(".hero h1");
    const controls = {
      padding: document.getElementById("padding"),
      radius: document.getElementById("radius"),
      font: document.getElementById("font"),
      color: document.getElementById("color")
    };
    const before = {
      padding: getComputedStyle(card).padding,
      radius: getComputedStyle(card).borderRadius,
      font: getComputedStyle(heroTitle).fontSize,
      color: rgbToHex(getComputedStyle(card).backgroundColor)
    };
    document.getElementById("session").textContent = sessionId;
    controls.padding.value = parseInt(before.padding) || 24;
    controls.radius.value = parseInt(before.radius) || 18;
    controls.font.value = parseInt(before.font) || 48;
    controls.color.value = before.color;

    function rgbToHex(value) {
      const match = value.match(/\\d+/g);
      if (!match || match.length < 3) return "#f3f5ef";
      return "#" + match.slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("");
    }
    function apply() {
      card.style.padding = controls.padding.value + "px";
      card.style.borderRadius = controls.radius.value + "px";
      card.style.backgroundColor = controls.color.value;
      heroTitle.style.fontSize = controls.font.value + "px";
      document.getElementById("paddingOut").textContent = controls.padding.value + "px";
      document.getElementById("radiusOut").textContent = controls.radius.value + "px";
      document.getElementById("fontOut").textContent = controls.font.value + "px";
    }
    Object.values(controls).forEach((control) => control.addEventListener("input", apply));
    apply();

    document.getElementById("save").addEventListener("click", async () => {
      const button = document.getElementById("save");
      button.disabled = true;
      const changes = [
        ["padding", before.padding, controls.padding.value + "px"],
        ["border-radius", before.radius, controls.radius.value + "px"],
        ["font-size", before.font, controls.font.value + "px"],
        ["background-color", before.color, controls.color.value]
      ].filter(([, previous, next]) => previous !== next)
       .map(([property, previous, next]) => ({ property, before: previous, after: next }));
      try {
        const response = await fetch("/api/change-sets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            workspace: ${JSON.stringify(workspace)},
            pageUrl: location.href,
            viewport: { width: innerWidth, height: innerHeight },
            target: { selector: ".metric-card", label: "Metric card", source: { file: "examples/embedded-demo/styles.css", line: 46 } },
            changes
          })
        });
        const item = await response.json();
        if (!response.ok) throw new Error(item.error ?? ("HTTP " + response.status));
        document.getElementById("feedback").innerHTML = "Saved draft <code>" + item.id + "</code>. Expand DOMTune in the conversation to apply it.";
      } catch (error) {
        document.getElementById("feedback").textContent = "Save failed: " + error.message;
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
