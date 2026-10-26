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

The first controlled-browser, zero-project-configuration slice is now implemented for Chromium-family browsers. Vite injection remains as a compatibility path.

## Current architecture

- `@domtune/core`: versioned ChangeSet types and Zod validation.
- `@domtune/overlay`: agent-neutral page overlay.
- `@domtune/browser`: agent-neutral Chromium launcher and CDP injector.
- `@domtune/transport`: persistent ChangeSet repository.
- `@domtune/vite`: development-time Vite injection.
- `@domtune/adapter-codex`: local bridge, MCP tools, MCP App, and Codex `ui/message` flow.
- `skills/apply-domtune`: workflow for applying and reporting a ChangeSet.

Agent-specific behavior must remain in adapters. Do not introduce Codex or Claude dependencies into core, overlay, or transport.

## Protocol decisions

- Current schema version: `1`.
- ChangeSet IDs use the `dt_` prefix.
- Explicit DOM source hints use `data-domtune-source="path:line"`; the current fixture intentionally omits the hint and exercises automatic CSS-rule, CSS source-map, static utility-class, and captured-value cascade resolution.
- Default local bridge: `http://127.0.0.1:47822`.
- `DOMTUNE_PORT` can override the bridge port; Vite `bridgeUrl` must match.
- The old Visual Tuner PoC may still be installed and uses port `47821`.

## Verification already completed

```text
npm install             passed, 0 vulnerabilities
npm run build           passed
npm test                passed, 14/14 tests
plugin runtime startup  passed
GET /health             passed
MCP App panel smoke     passed
controlled injection    passed without the Vite plugin
reload reinjection      passed, exactly one overlay
CSS Module source map   passed end to end in controlled-browser mode
Tailwind utility mapping passed end to end with cascade filtering
multi-source ChangeSet passed across CSS and CSS Module files
React/Vue ownership     passed against development fixtures
```

The build creates a self-contained local Codex runtime at `dist/plugin/stdio.cjs`. Build output and dependencies are intentionally ignored by Git.

## Controlled-browser milestone

- `open_domtune` defaults to an isolated controlled Chromium session.
- Chrome, Chromium, Microsoft Edge, and Brave are discovered from platform-standard locations.
- CDP injects the overlay into the current page and future page reloads.
- The ordinary Vite fixture no longer installs the DOMTune Vite plugin.
- Localhost targets are allowed by default; remote targets require explicit opt-in.
- `close_domtune` closes the browser associated with a session.
- `list_domtune_browser_sessions` reports sessions owned by the current plugin runtime.
- Parallel sessions, unreachable targets, abnormal exits, plugin-restart orphan recovery, and profile cleanup have real-browser smoke coverage.
- The default fixture maps `.metric-card` to `examples/vite-app/src/style.css:43` without a DOM source hint.
- The CSS Module fixture maps its hashed runtime class to `examples/vite-app/src/metric.module.css:1` when Vite development source maps are enabled.
- The Tailwind v4 fixture maps `rounded-[18px]` to its unique static occurrence in `examples/vite-app/src/main.ts` and ignores an overridden `44px` declaration.
- One ChangeSet can carry distinct `changes[].source` references; the fixture verifies padding in `style.css` and corner radius in `metric.module.css` together.
- Inline-style fallback maps React 19 to `examples/react-app/src/InsightCard.tsx` through its debug stack and Vite source map, and Vue 3 to `examples/vue-app/src/MomentumCard.vue` through component runtime metadata.
- Competing CSS-rule candidates are surfaced as unresolved and cannot produce a ChangeSet.

## Previous end-to-end baseline

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

- Automatic mapping currently covers unique CSS rules, CSS Modules, static Tailwind utilities, different-valued cascade conflicts, multi-source edits, and React/Vue development component ownership. Dynamic utility expressions, direct CSS-in-JS declaration ownership, cross-origin stylesheets, production framework builds, and equal-valued cascade conflicts remain future work.
- Only padding, corner radius, font size, and background color are exposed.
- The Claude Code adapter is not implemented.
- Git marketplace installs currently require a local build first; the release packaging strategy still needs to be finalized.
- No open-source license has been selected yet.

## Suggested prompt for the new project conversation

```text
Continue DOMTune from docs/HANDOFF.md. First verify the bootstrap state and tests, then configure the local DOMTune marketplace in this Codex environment and run the documented end-to-end test against the Vite fixture. Preserve the core/overlay/transport/adapter boundaries. Do not start controlled-browser or Claude Code work until the migrated Codex path passes end to end.
```
