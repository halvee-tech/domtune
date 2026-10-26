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

`@domtune/vite` injects the overlay during development. It is an integration package, not part of the core protocol. A controlled-browser injector can be added without changing ChangeSet consumers.

### Agent adapters

`@domtune/adapter-codex` owns all Codex-specific behavior: MCP tools, MCP App resources, `ui/message`, and the stdio entry point. A Claude Code adapter will implement the same session-level responsibilities using Claude session continuation APIs.

## Dependency direction

```text
core <- transport <- adapter-codex
             ^
overlay <- vite
```

Agent adapters may depend on core and transport. Core, overlay, and transport must never depend on an agent adapter.

## Current request flow

```text
Codex conversation
  -> open_domtune
  -> session ID + target URL
  -> Vite page loads the overlay
  -> user selects and adjusts a DOM element
  -> overlay POSTs a ChangeSet to the local bridge
  -> Codex MCP App observes the pending ChangeSet
  -> ui/message continues the same conversation
  -> agent calls get_domtune_change_set
  -> agent modifies and verifies source
  -> agent calls report_domtune_change_result
```

## Next architectural step

Add a controlled-browser launcher behind a generic browser-session interface. That will make the default flow project-configuration-free while retaining `@domtune/vite` as an optional enhanced source-mapping integration.
