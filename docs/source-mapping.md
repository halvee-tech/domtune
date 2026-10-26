# Source mapping

DOMTune maps a visual adjustment to source only when it has exact, workspace-local evidence. A wrong exact mapping is more dangerous than an unresolved mapping.

## Resolution order

1. An ancestor `data-domtune-source="path:line"` hint resolves as `method: explicit` after its path and line are validated.
2. In a controlled browser, DOMTune asks Chrome DevTools for the matched rules that explicitly declare the changed property.
3. Captured pre-edit computed values filter out matching declarations that were already overridden by the cascade.
4. When the stylesheet exposes a source map, the generated selector position is mapped to an existing workspace-local original file. A unique result records `method: source-map` and `confidence: exact`.
5. A generated Tailwind rule whose source map does not resolve to editable project source, including rules mapped into `node_modules`, is matched to its selected-element class and then to one static, unbroken occurrence in a supported template file. A unique result records `method: utility-class` and `confidence: exact`.
6. Without a usable source map, DOMTune accepts a stylesheet only when its complete runtime text equals the workspace source file exposed through `data-vite-dev-id` or `data-domtune-source-file`. A unique result records `method: css-rule` and `confidence: exact`.
7. The compatibility injection path performs the equivalent unique-rule check in the page CSSOM, without source-map or utility-class resolution.

Explicit hints remain useful for component props, generated styles, cross-origin stylesheets, and frameworks whose runtime CSS does not retain a direct source file.

## Safety behavior

- Paths outside the requested workspace are rejected.
- Dependency sources under `node_modules` are not treated as editable project targets.
- Source-map targets must exist in the workspace.
- Inactive media queries are ignored.
- Cross-origin or otherwise unreadable stylesheets are skipped.
- Repeated selectors, multiple matching source rules, missing source text, and multi-rule edits remain unresolved.
- Utility classes must appear as a complete static token exactly once in supported HTML, JavaScript, TypeScript, Vue, Svelte, or Astro source. Dynamic construction and repeated uses remain unresolved.
- Value-aware cascade filtering removes overridden declarations with different resolved values. Equal-valued competing declarations remain unresolved.
- An unresolved selection can still be adjusted as a visual draft, but **Send to Agent** refuses to create a ChangeSet and explains how to recover.

## Current coverage

The Vite fixture deliberately has no `data-domtune-source` attribute. Its ordinary `.metric-card` rule maps automatically to `examples/vite-app/src/style.css`. A CSS Module fixture verifies that a hashed runtime class maps back to `examples/vite-app/src/metric.module.css:1`. A Tailwind v4 fixture verifies that `rounded-[18px]` maps to its unique occurrence in `examples/vite-app/src/main.ts`, while an overridden `44px` declaration is excluded by captured-value filtering. Real-browser smoke coverage also verifies that unresolved competition cannot create a ChangeSet.

Vite disables CSS development source maps by default, so projects that want CSS Module or utility-class mapping must enable `css.devSourcemap`. Future mapping work includes dynamic utility expressions, CSS-in-JS, React and Vue component ownership, full cascade ranking, and multi-source ChangeSets.
