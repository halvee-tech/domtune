# Source mapping

DOMTune maps a visual adjustment to source only when it has exact, workspace-local evidence. A wrong exact mapping is more dangerous than an unresolved mapping.

## Resolution order

1. An ancestor `data-domtune-source="path:line"` hint resolves as `method: explicit` after its path and line are validated.
2. Otherwise, DOMTune inspects active, same-origin CSSOM rules that match the selected element and explicitly declare the changed property.
3. The stylesheet must expose a workspace-local file path. The first supported development-server signal is Vite's `data-vite-dev-id`; `data-domtune-source-file` is also accepted for integrations.
4. DOMTune locates the selector in the original style text and derives its one-based line.
5. Exactly one `file:line:selector` candidate must remain. The ChangeSet then records `method: css-rule` and `confidence: exact`.

Explicit hints remain useful for component props, generated styles, cross-origin stylesheets, and frameworks whose runtime CSS does not retain a direct source file.

## Safety behavior

- Paths outside the requested workspace are rejected.
- Inactive media queries are ignored.
- Cross-origin or otherwise unreadable stylesheets are skipped.
- Repeated selectors, multiple matching source rules, missing source text, and multi-rule edits remain unresolved.
- An unresolved selection can still be adjusted as a visual draft, but **Send to Agent** refuses to create a ChangeSet and explains how to recover.

## Current coverage

The Vite fixture deliberately has no `data-domtune-source` attribute. Its `.metric-card` rule maps automatically to `examples/vite-app/src/style.css:43`. Real-browser smoke coverage also adds competing workspace-local rules and verifies that no ChangeSet is created.

Future mapping work includes CSS source maps, CSS Modules, Tailwind utilities, CSS-in-JS, React and Vue component ownership, cascade ranking, and multi-source ChangeSets.
