# Architecture

DOMTune separates browser interaction, data transport, and coding-agent integration so that the same frontend workflow can work with Codex, Claude Code, and future hosts.

## Layers

### Core

`@domtune/core` owns the stable ChangeSet contract and its runtime schema. It must not import browser, MCP, Codex, Claude, or framework-specific code.

### Overlay

`@domtune/overlay` runs in the target page. It selects DOM elements, reads computed styles, applies temporary visual drafts, captures page context, and submits ChangeSets. Its copy and API are agent-neutral.

### Transport

`@domtune/transport` persists ChangeSets and exposes repository operations. The current implementation uses a JSON file; callers should depend on repository behavior rather than the storage format.

### Framework integration

`@domtune/vite` injects the overlay during development. It is an optional compatibility integration, not part of the core protocol. Controlled-browser injection uses the same overlay without changing ChangeSet consumers.

### Controlled browser

`@domtune/browser` owns the agent-neutral browser-session interface, Chromium discovery, isolated profiles, Chrome DevTools Protocol injection, matched-style, source-map, static utility-class, captured-value cascade, development framework ownership, and static component-style declaration resolution, plus lifecycle recovery. It depends on `@domtune/overlay`, but does not know about MCP or Codex. The current implementation keeps its CDP connection open so injection survives target-page reloads, persists enough metadata to clean confirmed orphaned sessions after a plugin restart, and removes profiles after normal or abnormal exit.

### Agent adapters

`@domtune/adapter-codex` owns all Codex-specific behavior: MCP tools, MCP App resources, `ui/message`, and the stdio entry point. A Claude Code adapter will implement the same session-level responsibilities using Claude session continuation APIs.

## Dependency direction

```text
core <- transport <- adapter-codex
                         ^
overlay <- vite          |
   ^                     |
   └──── browser ────────┘
```

Agent adapters may depend on core and transport. Core, overlay, and transport must never depend on an agent adapter.

## Current request flow

```text
Codex conversation
  -> open_domtune
  -> session ID + target URL
  -> adapter asks the generic browser launcher to open an isolated Chromium profile
  -> browser layer injects the agent-neutral overlay with CDP
  -> user selects and adjusts a DOM element
  -> browser resolves every changed property independently to an exact declaration or a scoped component owner
  -> overlay POSTs a ChangeSet to the local bridge
  -> Codex MCP App observes the pending ChangeSet
  -> ui/message continues the same conversation
  -> agent calls get_domtune_change_set
  -> agent modifies and verifies source
  -> agent calls report_domtune_change_result
```

## Compatibility path

`open_domtune` defaults to controlled-browser mode. Its `link` mode and `@domtune/vite` remain available for project-side injection. Source mapping prefers an explicit `data-domtune-source` hint, then a unique workspace-local source-map position or static utility-class occurrence, then a text-equivalent workspace CSS rule discovered through development-server metadata. Captured values eliminate overridden declarations when their resolved values differ. React or Vue ownership can then promote one matching static inline declaration to exact `component-style`; dynamic or ambiguous component styles retain lower-confidence ownership. Properties resolve independently and carry per-change sources; unresolved mappings are not submitted.
