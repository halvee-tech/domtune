# DOMTune

DOMTune lets a user adjust a real frontend visually and send a source-mapped ChangeSet back to the coding agent that owns the current conversation.

> Visual frontend tuning for coding agents.

## Status

This repository contains the first engineering migration of the validated DOMTune proof of concept. The current vertical slice supports:

- a controlled-browser-injected Shadow DOM overlay, with optional Vite compatibility injection;
- element selection and live adjustment of width, height, four-sided margin, border, padding, corner radius, typography, and color;
- versioned, persistent ChangeSets;
- a local HTTP bridge and stdio MCP server;
- a persistent Codex MCP App session bridge that turns a browser submission into a standard message in the originating conversation and can reconnect after plugin/runtime restarts;
- an agent skill for applying a ChangeSet to source code.
- exact source mapping for unique CSS rules, CSS Modules, and uniquely used static Tailwind utilities, with explicit hints as the highest-priority signal.
- per-property source references when one visual operation spans multiple source files.
- declaration-level mapping for unique static React and Vue inline styles, including statically verifiable scalar and nested object tokens from relative modules, with component ownership as the fallback for dynamic or generated values.
- static Token usage scope metadata so agents can distinguish a single-use value from a shared design decision before editing.
- an in-overlay confirmation gate before shared or unknown-scope Token changes are sent to the agent.
- a compact Chrome DevTools-inspired inspector with a selection-mode switch, hover and selected-element outlines, and viewport-aware placement beside the selected element.
- a multi-element draft queue: adjusted elements and elements with written instructions stay pending across successive selections, while untouched selections are discarded automatically.
- one request flow for slider adjustments, per-element natural-language prompts, or both together, with the full page URL and title included as route context.
- a compact, focus-mode inspector with mutually exclusive Layout, Appearance, and Type groups; the full box model, pending-target list, color inventory, and message composer expand only when needed.
- a DevTools-style box model editor with project colors collected from the rendered page plus an explicit custom color picker for surface, text, and border colors.

The default Codex flow now launches an isolated Chromium window and injects the overlay through the Chrome DevTools Protocol, so target projects do not need DOMTune in their Vite configuration. The Claude Code adapter is still planned.

For source mapping, DOMTune first honors `data-domtune-source`. Without a hint, controlled-browser mode inspects matched CSS rules through CDP, filters overridden declarations using captured computed values, resolves development source maps, and can locate a generated Tailwind utility at its unique static template occurrence. Each property is resolved independently, so one ChangeSet can safely point to multiple source files. When no editable rule exists, React and Vue development metadata identifies the owning component; one unique static declaration whose browser-resolved value matches the captured value is promoted to `component-style` with `exact` confidence. A `const` identifier or static member path such as `theme.card.radius` can be followed into the component or one relative named-import module and recorded as `component-token`. Static import and reference analysis adds `usageCount` plus `usageScope: single | shared | unknown`. Function calls, computed properties, mutable bindings, object spreads, and ambiguous values retain the lower `component-runtime` / `component` ownership result. Ambiguous or uninspectable styles are never reported as exact. Vite projects need `css.devSourcemap: true` for generated-style mapping. See [Source mapping](docs/source-mapping.md).

## Architecture

```text
Live frontend
  <- @domtune/browser injects @domtune/overlay
  -> @domtune/overlay captures intent
  -> versioned ChangeSet
  -> @domtune/transport
  -> agent adapter
       -> @domtune/adapter-codex
       -> Claude Code adapter (planned)
```

The core protocol and browser overlay do not depend on an agent vendor. See [Architecture](docs/architecture.md) and [ChangeSet protocol](docs/change-set-protocol.md).

## Packages

| Package | Responsibility |
| --- | --- |
| `@domtune/core` | ChangeSet types, schema version, and runtime validation |
| `@domtune/overlay` | Agent-neutral browser overlay client |
| `@domtune/browser` | Agent-neutral controlled Chromium launcher and CDP injector |
| `@domtune/transport` | Persistent ChangeSet repository |
| `@domtune/vite` | Development-time Vite injection |
| `@domtune/adapter-codex` | MCP tools, local bridge, and Codex conversation UI |

## Develop

Requires Node.js 20 or newer.

```bash
npm install
npm run build
npm test
```

Run the local bridge and an ordinary development server in separate terminals:

```bash
npm start
npm run demo:vite
```

Framework ownership fixtures are available with `npm run demo:react` and `npm run demo:vue`.

Then ask to adjust or inspect the running page. The bundled `open-domtune` skill automatically selects `open_domtune` from that intent, so the prompt does not need to name DOMTune. DOMTune opens an isolated Chrome, Chromium, Edge, or Brave window, injects the overlay without changing the target project's configuration, and keeps the agent turn waiting for **Send to Agent**. If no single development URL can be inferred, the agent asks before opening one.

The default fixture deliberately does not load `@domtune/vite`. To exercise the legacy project-side injection path instead, run:

```bash
npm run demo:vite:injected
```

The equivalent legacy session URL is:

```text
http://127.0.0.1:4174/?domTuneSession=local-demo
```

The local bridge listens on `http://127.0.0.1:47822` by default. Override it with `DOMTUNE_PORT` and pass the matching `bridgeUrl` to the Vite plugin when using a custom port.

Controlled-browser mode accepts localhost targets by default and uses a dedicated browser profile per DOMTune session. It checks that the development server is reachable before launching, supports concurrent sessions, retries one launch-time debugging-port race, and removes session profiles after normal or abnormal browser exit. On plugin startup it validates persisted session metadata before terminating confirmed orphaned DOMTune browsers. Set `DOMTUNE_BROWSER_EXECUTABLE` to an absolute Chromium-family executable when automatic discovery is insufficient. Remote targets require the explicit `DOMTUNE_ALLOW_REMOTE_TARGETS=1` opt-in. Use `list_domtune_browser_sessions` to inspect active sessions and `close_domtune` to close one.

## Codex plugin development

`npm run build` creates a self-contained local plugin runtime at `dist/plugin/stdio.cjs`. The repository root is the plugin root and contains `plugin.json`, `mcp.json`, and `skills/`. The `open-domtune` skill supports implicit invocation for live visual-adjustment requests; `apply-domtune` handles ChangeSets sent back from the browser.

For a local marketplace test, add this repository as a marketplace after building it, install `domtune@domtune-dev`, and start a fresh Codex chat.

## Project principles

- A visual operation represents user intent, not permission for an unrelated redesign.
- Agent-specific session behavior belongs in adapters, never in `core` or `overlay`.
- Every ChangeSet is schema-versioned and scoped to a workspace, page, viewport, and source target.
- Source changes must be minimal, maintainable, and verified across unaffected viewports.

The original feasibility record is preserved in [docs/feasibility.md](docs/feasibility.md).
