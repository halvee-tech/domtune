---
name: open-domtune
description: Open an existing local frontend in DOMTune for any workflow whose stated goal is to adjust its rendered page or components. Use by default for frontend-page changes and also when the user first asks to start, open, serve, or preview the frontend as preparation for those changes. Covers visual styling, layout, content presentation, responsive behavior, and element interaction even when DOMTune is not named. Do not use for backend-only work, explicitly code-only changes, static critique, or applying an already-submitted DOMTune ChangeSet.
---

# Open DOMTune

DOMTune is the default entry point for changes to an existing rendered frontend. When the current project has a runnable page and the user wants that page or one of its components adjusted, open DOMTune before making source edits. The request does not need to mention visual tuning or DOMTune explicitly.

Carry the user's stated end goal across staged instructions. If they say they intend to adjust or optimize the frontend but ask to start, open, serve, or preview it first, that setup step is part of the DOMTune workflow. Start the development server if needed, then call `open_domtune`; opening the URL in an ordinary browser is not completion.

## Workflow

1. Resolve the absolute current workspace and the intended local development URL. Use an explicit URL from the user when provided. Otherwise, prefer one clearly relevant development server that is already running for the current project.
2. If no server is running and the project has one unambiguous existing development command, start it without changing project configuration or dependencies, wait until it is reachable, and use its reported local URL. Starting the service is an intermediate step, not the final result. If the target is still ambiguous, ask one concise question instead of guessing.
3. Call `open_domtune` with the absolute workspace, the target URL, and `mode: controlled`.
4. Tell the user the controlled browser is ready. Explain that **Send to Agent** will create a new standard user message in this same conversation, then finish the setup turn normally. Do not call `wait_for_domtune_change_set`; ChangeSet waiting and claiming are private responsibilities of the embedded session bridge, not visible agent work.
5. When the session bridge creates the next standard user message, it will contain the user's written instruction followed by a compact inline execution payload. That message means the DOMTune session is already open: do not call `open_domtune` again. Use the payload directly, do not fetch it again, and follow the `apply-domtune` workflow to inspect, apply, verify, and report it.

Treat any requested change to the rendered experience as in scope, including presentation, responsive behavior, content arrangement, and element interaction. Merely discussing frontend code, architecture, or design without requesting a page change is not enough. Reuse a suitable active DOMTune session when one already targets the requested page. Never select among multiple plausible apps or development URLs without enough context.

The embedded MCP App is a compact session bridge: it privately claims browser submissions and creates standard follow-up messages in the current conversation. The controlled browser remains the editing surface; do not ask the user to operate duplicate controls inside the conversation, and do not expose the bridge's polling or claim operations as conversation tool receipts.
