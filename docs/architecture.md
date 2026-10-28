# Architecture

DOMTune separates browser interaction, data transport, and coding-agent integration so that the same frontend workflow can work with Codex, Claude Code, and future hosts.

## Layers

### Core

`@domtune/core` owns the stable ChangeSet contract and its runtime schema. It must not import browser, MCP, Codex, Claude, or framework-specific code.

### Overlay

`@domtune/overlay` runs in the target page. It selects DOM elements, reads computed styles, applies temporary visual drafts, captures page context, and submits ChangeSets. Its focus-mode inspector shows one of Layout, Appearance, or Type at a time. The DevTools-style box model, pending-target list, complete color inventory, and message composer use progressive disclosure. Its constrained palette ranks colors computed from the current page and permits those project-derived values only. Its copy and API are agent-neutral.

### Transport

`@domtune/transport` persists ChangeSets and exposes repository operations. The current implementation uses a JSON file; callers should depend on repository behavior rather than the storage format.

### Framework integration

`@domtune/vite` injects the overlay during development. It is an optional compatibility integration, not part of the core protocol. Controlled-browser injection uses the same overlay without changing ChangeSet consumers.

### Controlled browser

`@domtune/browser` owns the agent-neutral browser-session interface, Chromium discovery, isolated profiles, Chrome DevTools Protocol injection, matched-style, source-map, static utility-class, captured-value cascade, development framework ownership, static component-style declarations, restricted scalar/object-token resolution, and Token usage-scope analysis, plus lifecycle recovery. It depends on `@domtune/overlay`, but does not know about MCP or Codex. The controlled browser runs in its own process group and persists adoption metadata so target-page reloads and transient plugin-runtime restarts retain the browser. An explicit session close still terminates the browser and removes its profile.

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
  -> user enables selection mode, hovers, and selects DOM elements successively
  -> a compact viewport-aware inspector opens beside the current selection with box-model controls, project-derived color choices, a per-element prompt, or a combination
  -> effective edits and prompts remain in a multi-element draft queue; untouched intermediate selections are discarded
  -> browser attempts to resolve every changed property independently to an exact declaration or a scoped component owner; every target retains bounded DOM and compact HTML context when no unique source can be mapped
  -> the ChangeSet includes all meaningful targets plus the full page URL and title as route context
  -> overlay requires a second confirmation for shared or unknown-scope Token changes
  -> overlay POSTs a ChangeSet to the local bridge
  -> the private session bridge claims the pending ChangeSet
  -> sendFollowUpMessage creates a standard user message with the complete inline payload
  -> the wait result returns the complete ChangeSet payload, including user prompts and mapped operations
  -> the existing agent turn continues without depending on MCP App visibility or another lookup
  -> agent modifies and verifies source
  -> agent calls report_domtune_change_result
```

## Compatibility path

`open_domtune` defaults to controlled-browser mode. Its `link` mode and `@domtune/vite` remain available for project-side injection. Source mapping prefers an explicit `data-domtune-source` hint, then a unique workspace-local source-map position or static utility-class occurrence, then a text-equivalent workspace CSS rule discovered through development-server metadata. Captured values eliminate overridden declarations when their resolved values differ. React or Vue ownership can then promote one matching static inline declaration to exact `component-style`, or follow one immutable scalar reference to exact `component-token`; dynamic or ambiguous component styles retain lower-confidence ownership. Properties resolve independently and carry per-change sources. When mapping remains unresolved, the ChangeSet is still submitted with its URL, selector, compact HTML context, and captured before/after values, without inventing a source reference.
