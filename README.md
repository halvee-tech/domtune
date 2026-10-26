# DOMTune

DOMTune lets a user adjust a real frontend visually and send a source-mapped ChangeSet back to the coding agent that owns the current conversation.

> Visual frontend tuning for coding agents.

## Status

This repository contains the first engineering migration of the validated DOMTune proof of concept. The current vertical slice supports:

- a controlled-browser-injected Shadow DOM overlay, with optional Vite compatibility injection;
- element selection and live adjustment of padding, corner radius, font size, and surface color;
- versioned, persistent ChangeSets;
- a local HTTP bridge and stdio MCP server;
- a Codex MCP App bridge that can continue the originating conversation;
- an agent skill for applying a ChangeSet to source code.
- exact source mapping for unique CSS rules, CSS Modules, and uniquely used static Tailwind utilities, with explicit hints as the highest-priority signal.
- per-property source references when one visual operation spans multiple source files.
- development-time React and Vue component ownership as a fallback for inline or generated styles.

The default Codex flow now launches an isolated Chromium window and injects the overlay through the Chrome DevTools Protocol, so target projects do not need DOMTune in their Vite configuration. The Claude Code adapter is still planned.

For source mapping, DOMTune first honors `data-domtune-source`. Without a hint, controlled-browser mode inspects matched CSS rules through CDP, filters overridden declarations using captured computed values, resolves development source maps, and can locate a generated Tailwind utility at its unique static template occurrence. Each property is resolved independently, so one ChangeSet can safely point to multiple source files. When no editable rule exists, React and Vue development metadata can identify the owning component with explicitly lower `component` confidence. Ambiguous or uninspectable styles are blocked instead of being reported as exact. Vite projects need `css.devSourcemap: true` for generated-style mapping. See [Source mapping](docs/source-mapping.md).

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

Then call `open_domtune` with the absolute workspace and development URL. DOMTune opens an isolated Chrome, Chromium, Edge, or Brave window and injects the overlay without changing the target project's configuration.

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

`npm run build` creates a self-contained local plugin runtime at `dist/plugin/stdio.cjs`. The repository root is the plugin root and contains `plugin.json`, `mcp.json`, and `skills/`.

For a local marketplace test, add this repository as a marketplace after building it, install `domtune@domtune-dev`, and start a fresh Codex chat.

## Project principles

- A visual operation represents user intent, not permission for an unrelated redesign.
- Agent-specific session behavior belongs in adapters, never in `core` or `overlay`.
- Every ChangeSet is schema-versioned and scoped to a workspace, page, viewport, and source target.
- Source changes must be minimal, maintainable, and verified across unaffected viewports.

The original feasibility record is preserved in [docs/feasibility.md](docs/feasibility.md).
