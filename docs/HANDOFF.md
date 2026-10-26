# DOMTune handoff

Updated: 2026-10-26

## Repository

- Local path: `/Users/halveel./halvee/cowork/domtune`
- Remote: `https://github.com/halvee-tech/domtune.git`
- Branch: `main`
- Bootstrap commit: `c0744bc feat: bootstrap DOMTune monorepo`

The repository was empty before the migration. The bootstrap commit contains the engineering migration of the validated Visual Tuner PoC under the new DOMTune name.

## Product direction

DOMTune lets a user adjust a real frontend visually and send a structured, source-mapped ChangeSet back to the coding agent that owns the conversation.

The intended default experience is:

```text
Install the agent plugin once
  -> ask to open DOMTune
  -> DOMTune opens a controlled browser and injects the overlay
  -> user adjusts the real page
  -> Send to Agent
  -> the same conversation applies and verifies the source change
```

The controlled-browser, zero-project-configuration path is the next product milestone. The migrated implementation currently retains Vite injection as the working integration.

## Current architecture

- `@domtune/core`: versioned ChangeSet types and Zod validation.
- `@domtune/overlay`: agent-neutral page overlay.
- `@domtune/transport`: persistent ChangeSet repository.
- `@domtune/vite`: development-time Vite injection.
- `@domtune/adapter-codex`: local bridge, MCP tools, MCP App, and Codex `ui/message` flow.
- `skills/apply-domtune`: workflow for applying and reporting a ChangeSet.

Agent-specific behavior must remain in adapters. Do not introduce Codex or Claude dependencies into core, overlay, or transport.

## Protocol decisions

- Current schema version: `1`.
- ChangeSet IDs use the `dt_` prefix.
- DOM source hints use `data-domtune-source="path:line"` in the current fixture.
- Default local bridge: `http://127.0.0.1:47822`.
- `DOMTUNE_PORT` can override the bridge port; Vite `bridgeUrl` must match.
- The old Visual Tuner PoC may still be installed and uses port `47821`.

## Verification already completed

```text
npm install             passed, 0 vulnerabilities
npm run build           passed
npm test                passed, 3/3 tests
plugin runtime startup  passed
GET /health             passed
MCP App panel smoke     passed
Vite overlay injection  passed
```

The build creates a self-contained local Codex runtime at `dist/plugin/stdio.cjs`. Build output and dependencies are intentionally ignored by Git.

## Immediate next task

Run a fresh end-to-end test from a Codex project conversation using this repository rather than the old PoC:

1. Run `npm ci` and `npm test`.
2. Build the plugin with `npm run build`.
3. Add this repository as a local Codex marketplace and install `domtune@domtune-dev`.
4. Start a new Codex conversation in the DOMTune project.
5. Start the Vite fixture with `npm run demo:vite`.
6. Call `open_domtune` with the repository workspace and `http://127.0.0.1:4174/`.
7. Select the metric card, change a visual property, and click **Send to Agent**.
8. Confirm that the same conversation receives the ChangeSet, calls `get_domtune_change_set`, edits the mapped CSS, verifies it, and calls `report_domtune_change_result`.
9. Confirm that a refresh or plugin restart does not notify the conversation twice.

## Known limitations

- Source mapping still depends on an explicit `data-domtune-source` hint.
- Only padding, corner radius, font size, and background color are exposed.
- The controlled-browser launcher is not implemented.
- The Claude Code adapter is not implemented.
- Git marketplace installs currently require a local build first; the release packaging strategy still needs to be finalized.
- No open-source license has been selected yet.

## Suggested prompt for the new project conversation

```text
Continue DOMTune from docs/HANDOFF.md. First verify the bootstrap state and tests, then configure the local DOMTune marketplace in this Codex environment and run the documented end-to-end test against the Vite fixture. Preserve the core/overlay/transport/adapter boundaries. Do not start controlled-browser or Claude Code work until the migrated Codex path passes end to end.
```
