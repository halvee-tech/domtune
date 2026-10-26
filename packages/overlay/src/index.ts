export interface OverlayClientConfig {
  bridgeUrl: string;
  workspace: string;
  sessionId?: string;
  targetOrigin?: string;
}

export function buildOverlayClient(config: OverlayClientConfig): string {
  const markup = `
    <style>
      :host { all: initial; color-scheme: dark; }
      * { box-sizing: border-box; }
      .vt-panel { position: fixed; z-index: 2147483646; right: 18px; bottom: 18px; width: min(360px, calc(100vw - 36px)); border: 1px solid #303743; border-radius: 16px; padding: 14px; background: #0d1117; color: #eef2f7; box-shadow: 0 24px 64px rgb(0 0 0 / 38%); font: 13px/1.4 Inter, ui-sans-serif, system-ui, sans-serif; }
      .vt-head, .vt-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .vt-head { margin-bottom: 12px; }
      .vt-title { font-weight: 750; letter-spacing: -.01em; }
      .vt-session { max-width: 150px; overflow: hidden; color: #8f9aab; font: 10px/1.2 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .vt-target { margin: 0 0 12px; padding: 10px 11px; border: 1px solid #262d37; border-radius: 10px; background: #131922; color: #aeb8c7; font: 11px/1.45 ui-monospace, monospace; overflow-wrap: anywhere; }
      .vt-controls { display: grid; gap: 11px; }
      .vt-controls[hidden] { display: none; }
      .vt-row { display: grid; grid-template-columns: 1fr auto; gap: 5px 10px; color: #c5ceda; font-size: 12px; }
      .vt-row output { font: 650 11px/1 ui-monospace, monospace; }
      .vt-row input[type=range] { grid-column: 1 / -1; width: 100%; accent-color: #6fe0a5; }
      .vt-row input[type=color] { width: 40px; height: 30px; border: 1px solid #38414e; border-radius: 7px; padding: 3px; background: #0a0e13; }
      .vt-actions { display: grid; grid-template-columns: 1fr 1.25fr; gap: 8px; margin-top: 13px; }
      button { min-height: 42px; border: 0; border-radius: 9px; padding: 0 12px; cursor: pointer; font: 700 12px/1 system-ui, sans-serif; }
      .vt-select { background: #222a35; color: #dce3ed; }
      .vt-send { background: #6fe0a5; color: #07140d; }
      button:disabled { cursor: not-allowed; opacity: .45; }
      button:focus-visible, input:focus-visible { outline: 3px solid #9bb6ff; outline-offset: 2px; }
      .vt-feedback { min-height: 17px; margin: 10px 0 0; color: #9ba6b6; font-size: 11px; }
      .vt-error { color: #ff9d9d; }
    </style>
    <section class="vt-panel" aria-label="DOMTune">
      <div class="vt-head"><span class="vt-title">DOMTune</span><span class="vt-session"></span></div>
      <p class="vt-target">Select an element to inspect its computed style.</p>
      <div class="vt-controls" hidden>
        <label class="vt-row">Padding <output data-out="padding"></output><input data-control="padding" type="range" min="0" max="80" /></label>
        <label class="vt-row">Corner radius <output data-out="radius"></output><input data-control="radius" type="range" min="0" max="64" /></label>
        <label class="vt-row">Font size <output data-out="font"></output><input data-control="font" type="range" min="8" max="96" /></label>
        <label class="vt-row">Surface <input data-control="color" type="color" /></label>
      </div>
      <div class="vt-actions"><button class="vt-select" type="button">Select element</button><button class="vt-send" type="button" disabled>Send to Agent</button></div>
      <p class="vt-feedback" role="status"></p>
    </section>`;

  return `(() => {
    const config = ${JSON.stringify(config)};
    if (config.targetOrigin && location.origin !== config.targetOrigin) return;
    const mount = () => {
    if (document.querySelector("domtune-overlay")) return;
    const params = new URLSearchParams(location.search);
    const sessionId = config.sessionId || params.get("domTuneSession") || "";
    const host = document.createElement("domtune-overlay");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = ${JSON.stringify(markup)};
    document.documentElement.appendChild(host);

    const sessionEl = shadow.querySelector(".vt-session");
    const targetEl = shadow.querySelector(".vt-target");
    const controlsEl = shadow.querySelector(".vt-controls");
    const selectButton = shadow.querySelector(".vt-select");
    const sendButton = shadow.querySelector(".vt-send");
    const feedbackEl = shadow.querySelector(".vt-feedback");
    const controls = Object.fromEntries([...shadow.querySelectorAll("[data-control]")].map((node) => [node.dataset.control, node]));
    const outputs = Object.fromEntries([...shadow.querySelectorAll("[data-out]")].map((node) => [node.dataset.out, node]));
    sessionEl.textContent = sessionId || "No session";
    if (!sessionId) {
      feedbackEl.textContent = "Open this page from a DOMTune agent session.";
      feedbackEl.classList.add("vt-error");
    }

    let armed = false;
    let hovered = null;
    let selected = null;
    let selectedToken = "";
    let baseline = null;
    const touched = new Set();
    let previousOutline = "";

    function px(value, fallback) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function rgbToHex(value) {
      const values = value.match(/\\d+/g);
      if (!values || values.length < 3) return "#ffffff";
      if (values.length > 3 && Number(values[3]) === 0) return "#ffffff";
      return "#" + values.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
    }

    function selectorFor(element) {
      if (element.id) return "#" + CSS.escape(element.id);
      const path = [];
      let node = element;
      while (node && node !== document.body && path.length < 4) {
        let part = node.tagName.toLowerCase();
        const classes = [...node.classList].filter((name) => !name.startsWith("vt-")).slice(0, 2);
        if (classes.length) part += "." + classes.map((name) => CSS.escape(name)).join(".");
        path.unshift(part);
        node = node.parentElement;
      }
      return path.join(" > ");
    }

    function explicitSourceFor(element) {
      const sourceNode = element.closest("[data-domtune-source]");
      const value = sourceNode?.getAttribute("data-domtune-source");
      if (!value) return null;
      const separator = value.lastIndexOf(":");
      if (separator < 1) return null;
      const file = normalizeWorkspaceFile(value.slice(0, separator));
      const line = Number(value.slice(separator + 1));
      if (!file || !Number.isInteger(line) || line < 1) return null;
      return { file, line, method: "explicit", confidence: "exact" };
    }

    function normalizeWorkspaceFile(value) {
      let file = decodeURIComponent(String(value || "")).replaceAll("\\\\", "/");
      if (file.startsWith("file://")) {
        try { file = decodeURIComponent(new URL(file).pathname); } catch { return null; }
      }
      if (file.startsWith("/@fs/")) file = file.slice(4);
      let workspace = String(config.workspace || "").replaceAll("\\\\", "/");
      if (workspace.endsWith("/")) workspace = workspace.slice(0, -1);
      const windowsAbsolute = file.length > 2 && /[A-Za-z]/.test(file[0]) && file[1] === ":" && file[2] === "/";
      const absolute = file.startsWith("/") || windowsAbsolute;
      if (!absolute) return file.startsWith("./") ? file.slice(2) : file;
      if (file === workspace) return ".";
      if (!workspace || !file.startsWith(workspace + "/")) return null;
      return file.slice(workspace.length + 1);
    }

    function sourceFileForSheet(sheet) {
      const owner = sheet.ownerNode;
      const hinted = owner?.getAttribute?.("data-vite-dev-id") || owner?.getAttribute?.("data-domtune-source-file");
      if (hinted) return normalizeWorkspaceFile(hinted);
      if (!sheet.href) return null;
      try {
        const url = new URL(sheet.href, location.href);
        return normalizeWorkspaceFile(url.pathname);
      } catch {
        return null;
      }
    }

    function lineForSelector(text, selector) {
      if (!text || !selector) return null;
      let offset = 0;
      let found = null;
      while (offset < text.length) {
        const index = text.indexOf(selector, offset);
        if (index < 0) return found;
        const next = text.slice(index + selector.length).trimStart()[0];
        if (next === "{" || next === ",") {
          if (found !== null) return null;
          found = text.slice(0, index).split("\\n").length;
        }
        offset = index + selector.length;
      }
      return found;
    }

    function ruleDeclares(rule, property) {
      if (rule.style.getPropertyValue(property)) return true;
      if (property === "background-color" && rule.style.getPropertyValue("background")) return true;
      return false;
    }

    function matchingRules(element, properties) {
      const matches = [];
      function visit(rules, sheet) {
        for (const rule of rules) {
          if (rule.type === 1 && rule.selectorText) {
            let selected = false;
            try { selected = element.matches(rule.selectorText); } catch { selected = false; }
            if (!selected || !properties.some((property) => ruleDeclares(rule, property))) continue;
            const file = sourceFileForSheet(sheet);
            const text = sheet.ownerNode?.textContent || "";
            const line = lineForSelector(text, rule.selectorText);
            if (file && line) matches.push({ file, line, selector: rule.selectorText, method: "css-rule", confidence: "exact" });
            continue;
          }
          if (!rule.cssRules) continue;
          if (rule.conditionText && typeof matchMedia === "function" && !matchMedia(rule.conditionText).matches) continue;
          visit(rule.cssRules, sheet);
        }
      }
      for (const sheet of document.styleSheets) {
        try { visit(sheet.cssRules, sheet); } catch { /* Cross-origin stylesheets are not inspectable. */ }
      }
      return matches;
    }

    function sourceFor(element, properties) {
      const explicit = explicitSourceFor(element);
      if (explicit) return explicit;
      const unique = new Map();
      for (const candidate of matchingRules(element, properties)) unique.set(candidate.file + ":" + candidate.line + ":" + candidate.selector, candidate);
      if (unique.size !== 1) return null;
      const candidate = [...unique.values()][0];
      return { file: candidate.file, line: candidate.line, method: candidate.method, confidence: candidate.confidence };
    }

    async function controlledBrowserSource(properties, before) {
      if (!selectedToken) return null;
      try {
        const response = await fetch(config.bridgeUrl + "/api/source-map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, targetToken: selectedToken, properties, before })
        });
        const result = await response.json();
        if (response.status === 404 && result.reason === "session-not-found") return null;
        if (!response.ok && response.status !== 404) throw new Error(result.error || ("HTTP " + response.status));
        return result;
      } catch {
        return null;
      }
    }

    function clearHover() {
      if (!hovered || hovered === selected) return;
      hovered.style.outline = previousOutline;
      hovered = null;
      previousOutline = "";
    }

    function selectElement(element) {
      clearHover();
      if (selected && selected !== element) selected.removeAttribute("data-domtune-target");
      selected = element;
      selectedToken = sessionId.replace(/[^A-Za-z0-9_-]/g, "") + "_" + Date.now().toString(36);
      selected.setAttribute("data-domtune-target", selectedToken);
      const style = getComputedStyle(element);
      baseline = {
        padding: style.padding,
        radius: style.borderRadius,
        font: style.fontSize,
        color: style.backgroundColor
      };
      touched.clear();
      controls.padding.value = String(Math.round(px(style.paddingTop, 0)));
      controls.radius.value = String(Math.round(px(style.borderTopLeftRadius, 0)));
      controls.font.value = String(Math.round(px(style.fontSize, 16)));
      controls.color.value = rgbToHex(style.backgroundColor);
      controlsEl.hidden = false;
      sendButton.disabled = !sessionId;
      const source = sourceFor(element, ["padding", "border-radius", "font-size", "background-color"]);
      targetEl.textContent = selectorFor(element) + (source ? " · " + (source.method === "css-rule" ? "auto " : "") + source.file + ":" + source.line : " · source pending");
      selectButton.textContent = "Select another";
      updateOutputs();
      return source;
    }

    function updateOutputs() {
      outputs.padding.textContent = controls.padding.value + "px";
      outputs.radius.textContent = controls.radius.value + "px";
      outputs.font.textContent = controls.font.value + "px";
    }

    function applyDraft(name) {
      if (!selected) return;
      if (name === "padding") selected.style.padding = controls.padding.value + "px";
      if (name === "radius") selected.style.borderRadius = controls.radius.value + "px";
      if (name === "font") selected.style.fontSize = controls.font.value + "px";
      if (name === "color") selected.style.backgroundColor = controls.color.value;
      updateOutputs();
    }

    Object.entries(controls).forEach(([name, control]) => control.addEventListener("input", () => {
      touched.add(name);
      applyDraft(name);
    }));

    selectButton.addEventListener("click", () => {
      armed = true;
      selectButton.textContent = "Click a page element";
      feedbackEl.textContent = "Selection mode is active. Press Escape to cancel.";
      feedbackEl.classList.remove("vt-error");
    });

    document.addEventListener("pointerover", (event) => {
      if (!armed || host.contains(event.target)) return;
      clearHover();
      hovered = event.target;
      previousOutline = hovered.style.outline;
      hovered.style.outline = "2px solid #6fe0a5";
    }, true);

    document.addEventListener("click", (event) => {
      if (!armed || host.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      armed = false;
      const source = selectElement(event.target.closest("[data-domtune-source]") || event.target);
      feedbackEl.textContent = source
        ? (source.method === "css-rule" ? "Element selected. Source mapped automatically." : "Element selected. Source hint verified.")
        : "Element selected. Adjust a value; DOMTune will resolve its CSS rule before sending.";
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !armed) return;
      armed = false;
      clearHover();
      selectButton.textContent = selected ? "Select another" : "Select element";
      feedbackEl.textContent = "Selection cancelled.";
    });

    sendButton.addEventListener("click", async () => {
      if (!selected || !baseline || !sessionId) return;
      const next = {
        padding: controls.padding.value + "px",
        radius: controls.radius.value + "px",
        font: controls.font.value + "px",
        color: controls.color.value
      };
      const changes = [
        ["padding", "padding", baseline.padding, next.padding],
        ["radius", "border-radius", baseline.radius, next.radius],
        ["font", "font-size", baseline.font, next.font],
        ["color", "background-color", baseline.color, next.color]
      ].filter((entry) => touched.has(entry[0]) && entry[2] !== entry[3])
       .map((entry) => ({ property: entry[1], before: entry[2], after: entry[3] }));
      if (!changes.length) {
        feedbackEl.textContent = "Change at least one value before sending.";
        feedbackEl.classList.add("vt-error");
        return;
      }
      sendButton.disabled = true;
      sendButton.textContent = "Mapping…";
      feedbackEl.classList.remove("vt-error");
      const properties = changes.map((change) => change.property);
      const before = Object.fromEntries(changes.map((change) => [change.property, change.before]));
      const explicit = explicitSourceFor(selected);
      const controlled = explicit ? null : await controlledBrowserSource(properties, before);
      const source = explicit || controlled?.source || (controlled ? null : sourceFor(selected, properties));
      if (!source) {
        sendButton.disabled = false;
        sendButton.textContent = "Send to Agent";
        feedbackEl.textContent = controlled?.reason === "ambiguous"
          ? "Multiple source rules match this change. Adjust one property or add a source hint."
          : "Could not map these changes to one source rule. Adjust one property or add a source hint.";
        feedbackEl.classList.add("vt-error");
        return;
      }
      sendButton.textContent = "Sending…";
      try {
        const response = await fetch(config.bridgeUrl + "/api/change-sets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            origin: "browser-overlay",
            workspace: config.workspace,
            pageUrl: location.href,
            viewport: { width: innerWidth, height: innerHeight },
            target: { selector: selectorFor(selected), label: selected.getAttribute("aria-label") || selected.tagName.toLowerCase(), source },
            changes
          })
        });
        const item = await response.json();
        if (!response.ok) throw new Error(item.error || ("HTTP " + response.status));
        feedbackEl.textContent = "Sent " + item.id + ". The linked agent conversation can now continue.";
        sendButton.textContent = "Sent to Agent";
      } catch (error) {
        sendButton.disabled = false;
        sendButton.textContent = "Send to Agent";
        feedbackEl.textContent = "Could not send changes: " + error.message;
        feedbackEl.classList.add("vt-error");
      }
    });
    };
    if (document.documentElement) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  })();`;
}
