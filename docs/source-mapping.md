# Source mapping

DOMTune maps a visual adjustment to source only when it has exact, workspace-local evidence. A wrong exact mapping is more dangerous than an unresolved mapping.

## Resolution order

1. An ancestor `data-domtune-source="path:line"` hint resolves as `method: explicit` after its path and line are validated.
2. In a controlled browser, DOMTune asks Chrome DevTools for the matched rules that explicitly declare the changed property.
3. When the stylesheet exposes a source map, the generated selector position is mapped to an existing workspace-local original file. A unique result records `method: source-map` and `confidence: exact`.
4. Without a usable source map, DOMTune accepts a stylesheet only when its complete runtime text equals the workspace source file exposed through `data-vite-dev-id` or `data-domtune-source-file`. A unique result records `method: css-rule` and `confidence: exact`.
5. The compatibility injection path performs the equivalent unique-rule check in the page CSSOM, without source-map decoding.

Explicit hints remain useful for component props, generated styles, cross-origin stylesheets, and frameworks whose runtime CSS does not retain a direct source file.

## Safety behavior

- Paths outside the requested workspace are rejected.
- Source-map targets must exist in the workspace.
- Inactive media queries are ignored.
- Cross-origin or otherwise unreadable stylesheets are skipped.
- Repeated selectors, multiple matching source rules, missing source text, and multi-rule edits remain unresolved.
- An unresolved selection can still be adjusted as a visual draft, but **Send to Agent** refuses to create a ChangeSet and explains how to recover.

## Current coverage

The Vite fixture deliberately has no `data-domtune-source` attribute. Its ordinary `.metric-card` rule maps automatically to `examples/vite-app/src/style.css:43`. A CSS Module fixture also verifies that a hashed runtime class maps back to `examples/vite-app/src/metric.module.css:1` through a Vite development source map. Real-browser smoke coverage adds competing workspace-local rules and verifies that no ChangeSet is created.

Vite disables CSS development source maps by default, so projects that want CSS Module mapping must enable `css.devSourcemap`. Future mapping work includes Tailwind utilities, CSS-in-JS, React and Vue component ownership, cascade ranking, and multi-source ChangeSets.
