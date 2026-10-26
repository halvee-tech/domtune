# DOMTune

DOMTune lets a user adjust a real frontend visually and send a source-mapped ChangeSet back to the coding agent that owns the current conversation.

> Visual frontend tuning for coding agents.

## Status

This repository contains the first engineering migration of the validated DOMTune proof of concept. The current vertical slice supports:

- a Vite-injected Shadow DOM overlay;
- element selection and live adjustment of padding, corner radius, font size, and surface color;
- versioned, persistent ChangeSets;
- a local HTTP bridge and stdio MCP server;
- a Codex MCP App bridge that can continue the originating conversation;
- an agent skill for applying a ChangeSet to source code.

The managed-browser, zero-project-configuration flow and the Claude Code adapter are planned but are not implemented yet.

## Architecture

```text
Live frontend
  -> @domtune/overlay
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

Run the local bridge and the Vite fixture in separate terminals:

```bash
npm start
npm run demo:vite
```

Then open a DOMTune session through the MCP tool, or use a fixture URL such as:

```text
http://127.0.0.1:4174/?domTuneSession=local-demo
```

The local bridge listens on `http://127.0.0.1:47822` by default. Override it with `DOMTUNE_PORT` and pass the matching `bridgeUrl` to the Vite plugin when using a custom port.

## Codex plugin development

`npm run build` creates a self-contained local plugin runtime at `dist/plugin/stdio.cjs`. The repository root is the plugin root and contains `plugin.json`, `mcp.json`, and `skills/`.

For a local marketplace test, add this repository as a marketplace after building it, install `domtune@domtune-dev`, and start a fresh Codex chat.

## Project principles

- A visual operation represents user intent, not permission for an unrelated redesign.
- Agent-specific session behavior belongs in adapters, never in `core` or `overlay`.
- Every ChangeSet is schema-versioned and scoped to a workspace, page, viewport, and source target.
- Source changes must be minimal, maintainable, and verified across unaffected viewports.

The original feasibility record is preserved in [docs/feasibility.md](docs/feasibility.md).
