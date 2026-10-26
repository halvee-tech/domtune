---
name: apply-domtune
description: Apply frontend adjustments captured by DOMTune to their mapped source files. Use when a user submits a DOMTune ChangeSet or asks to apply the latest captured page adjustments.
---

# Apply DOMTune Changes

Use the DOMTune MCP tools to retrieve the requested ChangeSet. Treat captured values as the user's visual intent, not as permission to redesign unrelated UI.

## Workflow

1. Call `get_domtune_change_set` with the exact ChangeSet ID from the user message. If the user explicitly requests the latest pending set, call `list_domtune_change_sets` and select only the latest pending item.
2. Verify that `schemaVersion` is supported and the mapped source file belongs to the current workspace. Stop if it points outside the workspace or the source mapping is ambiguous.
3. Inspect nearby components, styles, responsive rules, and design tokens. Prefer existing tokens and utilities over new magic values.
4. Apply the smallest maintainable change that preserves unaffected viewports, states, and component instances.
5. Run proportionate formatting, type checks, and relevant tests. When a preview command is available, verify the affected viewport.
6. Call `report_domtune_change_result` with changed files, the verification summary, and either `applied` or `failed`.

Do not process unrelated pending ChangeSets or silently broaden a local edit into a shared component redesign. If the requested adjustment conflicts with accessibility or an established design token, explain the conflict before applying a materially different result.
