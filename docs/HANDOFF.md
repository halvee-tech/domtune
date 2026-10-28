# DOMTune handoff

Updated: 2026-10-28

## Repository checkpoint

- Remote: `https://github.com/halvee-tech/domtune.git`
- Branch: `main`
- Continue from the latest pushed `origin/main` checkpoint.
- Runtime requirements: Node.js 20 or newer, npm, and a Chromium-family browser.
- Generated `dist/`, dependencies, browser profiles, ChangeSets, and plugin runtime data are intentionally not committed.

## Product direction

DOMTune lets a user select elements on a real local frontend, tune them visually, and send a compact execution payload back as a standard message in the originating Codex conversation. The agent then applies the request to source code and reports the result.

```text
Install the local plugin once
  -> ask Codex to adjust or open a frontend
  -> DOMTune opens an isolated controlled browser
  -> select and tune one or more elements
  -> Send to Agent
  -> the originating conversation applies and verifies the source change
```

The controlled-browser path is the default. Project-side Vite injection remains only as a compatibility path.

## Current architecture

- `@domtune/core`: versioned ChangeSet contract and Zod validation.
- `@domtune/overlay`: browser editor, selection state, pending-element queue, and delivery status.
- `@domtune/browser`: Chromium launcher, CDP injection, source mapping, page discovery, and restart adoption.
- `@domtune/transport`: persistent, serialized ChangeSet repository and conversation claims.
- `@domtune/vite`: optional legacy Vite injection.
- `@domtune/adapter-codex`: local HTTP bridge, stdio MCP server, MCP App resources, and standard conversation-message handoff.
- `skills/open-domtune`: implicitly opens DOMTune for concrete frontend-adjustment work.
- `skills/apply-domtune`: applies an inline DOMTune payload, verifies the source change, and reports the result.

Keep agent-specific behavior in adapters. Core, overlay, browser transport contracts, and ChangeSets must remain agent-neutral.

## Implemented interaction

- **Select element** is a switch. Turning it off removes the panel, hover outline, selected outline, canvas toolbar, and drag handles.
- Hovering an element shows an outline; selecting it anchors the editor near the element while staying inside the viewport and avoiding the active drag edge.
- Direct manipulation supports size, four-sided padding, margin, border, and four independent radii.
- Scope controls support all sides, opposite sides, or one side/corner where applicable.
- Quick controls expose font size, text color, and background color. Border mode also exposes border color.
- Color controls have two levels: colors collected from the rendered page plus a custom native color picker. The custom picker reflects the current selected color.
- Enter sends the prompt; Shift+Enter inserts a newline.
- Adjusted elements and elements with written prompts remain in a pending queue. An untouched intermediate selection is discarded.
- Pending entries can be selected again or cleared individually.
- One submission includes all effective pending elements, the page URL/title, compact HTML/selector context, per-element prompts, and mapped visual changes.
- Multiple controlled windows can submit concurrently; the store serializes writes and preserves send order.
- The overlay shows queued, sending, Codex working, applied, failed, and connection-paused states.

## Conversation and restart behavior

- The MCP App bridge claims a pending ChangeSet and sends it as a standard user message with a compact inline payload. The agent does not fetch the ChangeSet by ID again.
- Browser sessions persist `conversationKey`, workspace, URL, PID, debug port, and creation time in `PLUGIN_DATA/browser-sessions/<session>/session.json`.
- Controlled Chrome runs in its own process group. Recycling or restarting the plugin process no longer closes the browser.
- A replacement plugin runtime adopts the surviving browser, reconnects CDP, discovers all matching tabs, and reinjects the overlay.
- `resume_domtune` is an app-private thread entrypoint using the current `panel-v2` resource. It reconnects the bridge for an existing conversation.
- The overlay detects a missing bridge heartbeat and tells the user to reopen DOMTune in the conversation.
- A conversation claim abandoned for more than 60 seconds can be reclaimed, so a dead iframe does not leave a request permanently stuck.
- Legacy `panel-v1` remains registered so an older rendered tool result can load the current bridge UI.

Important distinction:

- Restarting Codex on the **same computer** preserves active controlled-browser sessions and pending ChangeSets.
- Git and ChatGPT conversation sync do **not** migrate local Chrome processes, browser profiles, or `PLUGIN_DATA` to another computer. On a new computer, install the plugin and open a fresh DOMTune browser session from the old or a new conversation.

## Protocol decisions

- Current schema version: `1`.
- ChangeSet IDs use the `dt_` prefix.
- Explicit source hints use `data-domtune-source="path:line"`.
- Default bridge: `http://127.0.0.1:47822`; override with `DOMTUNE_PORT`.
- Compact agent payloads remove `domTuneSession` from the page URL, replace long target IDs with `t1`, `t2`, and omit duplicated fields.
- Missing or ambiguous source mapping is not a send blocker. DOMTune still sends the page address, selector, compact HTML, text/classes, requested prompt, and captured values so the agent can investigate.
- Static component-token mapping reports `usageCount` and `usageScope: single | shared | unknown`. Shared/unknown changes require confirmation in the overlay.

## Verification at this checkpoint

```text
npm ci                  passed
npm test                passed, 30/30 tests
git diff --check        passed
plugin bundle           built at dist/plugin/stdio.cjs
local plugin install    bundle hash matched installed cache
GET /health             passed
MCP tool/resource list  passed for panel-v1, panel-v2, and resume_domtune
controlled injection    passed without project-side Vite configuration
plugin process restart  passed: Chrome survived and was adopted by the new runtime
reload reinjection      passed with exactly one overlay
multi-window store      passed with concurrent submissions preserved in send order
source mapping          CSS, CSS Modules, Tailwind, React, Vue, scalar/object tokens
multi-element queue     adjusted a/b + untouched c + prompted d submitted a/b/d
status recovery         heartbeat pause, stale-claim release/reclaim, applied/failed states
```

Run `npm test` again after cloning. It rebuilds every package and the self-contained plugin bundle before running the tests.

## Continue on another computer

```bash
git clone https://github.com/halvee-tech/domtune.git
cd domtune
npm ci
npm test
codex plugin marketplace add "$(pwd)"
codex plugin add domtune@domtune-dev
```

Then restart the ChatGPT/Codex desktop app so it reloads the locally built plugin files. The repository marketplace is already defined in `.agents/plugins/marketplace.json`. Local marketplace plugins are loaded from the Codex cache, so rebuild and reinstall/refresh after changing the plugin bundle.

For an end-to-end fixture:

```bash
npm run demo:vite
```

Open a project conversation rooted at this repository and ask: `打开测试页面，我要调整前端。` The `open-domtune` skill should start a controlled session for `http://127.0.0.1:4174/` without requiring the user to name DOMTune.

## Recommended next verification

1. On the new computer, run three or more consecutive **Send to Agent** rounds in one conversation.
2. Let one round complete, close/reopen the conversation, and confirm the thread entrypoint reconnects without duplicating the request.
3. Restart Codex while the controlled Chrome remains open; confirm the browser survives and the new plugin runtime adopts it.
4. Open two controlled windows for the same app and confirm both can submit in order.
5. Verify the overlay transitions from queued to Codex working to applied, and that a hidden/closed bridge changes to connection paused instead of waiting forever.

## Known limitations

- Local runtime state is machine-specific and does not roam with Git or conversation history.
- Existing sessions created before `conversationKey` persistence can only use the safe single-active-session fallback.
- Source mapping intentionally falls back to contextual agent investigation for dynamic utilities, computed/composed theme tokens, transitive barrel imports, cross-origin stylesheets, production framework builds, and ambiguous equal-valued cascade candidates.
- The project-color inventory is collected from the active rendered page, not from every unopened route or static design-token file.
- The Claude Code adapter is not implemented.
- Git marketplace installs require a local build; release packaging is still unresolved.
- No open-source license has been selected.

## Suggested first message on the new computer

```text
Continue DOMTune from docs/HANDOFF.md at the latest origin/main checkpoint. First run npm ci and npm test, then install/refresh the local domtune-dev marketplace plugin and restart Codex. Run the documented multi-round restart-recovery test against the Vite fixture. Preserve the core/overlay/browser/transport/adapter boundaries, do not redo the completed inspector UI, and do not commit until I confirm the new-computer smoke test.
```
