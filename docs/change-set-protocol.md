# ChangeSet protocol

DOMTune ChangeSets are the stable boundary between a browser interaction and a coding agent.

## Version 1

```ts
interface ChangeSet {
  schemaVersion: 1;
  id: `dt_${string}`;
  sessionId: string;
  status: "pending" | "applied" | "failed";
  createdAt: string;
  origin?: "embedded" | "browser-overlay";
  conversationNotifiedAt?: string;
  workspace: string;
  pageUrl: string;
  viewport: { width: number; height: number };
  target: {
    selector: string;
    label: string;
    source: {
      file: string;
      line: number;
      method?: "explicit" | "css-rule" | "source-map" | "utility-class" | "component-runtime" | "component-style";
      confidence?: "exact" | "component";
    };
  };
  changes: Array<{
    property: string;
    before: string;
    after: string;
    source?: {
      file: string;
      line: number;
      method?: "explicit" | "css-rule" | "source-map" | "utility-class" | "component-runtime" | "component-style";
      confidence?: "exact" | "component";
    };
  }>;
  result?: {
    summary: string;
    changedFiles: string[];
    verification: string[];
  };
}
```

## Rules

1. Producers submit an unversioned `NewChangeSet`; the trusted transport assigns `schemaVersion`, ID, status, and timestamp.
2. Consumers reject unsupported schema versions rather than guessing.
3. A source path is a hint that must be checked against the active workspace before editing.
4. `changes` records visual intent. It does not prescribe whether the implementation should update CSS, a token, a utility class, or a component prop.
5. An adapter may notify a conversation only once for a given ChangeSet.
6. Applying a ChangeSet must end with an `applied` or `failed` report containing verification evidence.
7. `source.method` records whether the producer used an explicit source hint, a unique source-map position, a unique matching CSS rule, a uniquely located static utility class, framework component ownership, or a statically verified component style declaration. Producers must not mark ambiguous candidates as `exact`.
8. `target.source` is the primary source for backward compatibility. When one operation spans multiple rules, each `changes[].source` records its own exact target. Consumers should prefer the per-change source when present.
9. `confidence: component` identifies the owning React or Vue component when no editable style rule can be mapped. It is a scoped inspection starting point, not a claim that the captured value is declared on that exact line.
10. `method: component-style` with `confidence: exact` identifies one static declaration in the owning component whose browser-resolved value matches the captured pre-edit value. Dynamic and duplicate declarations must not be promoted to this method.
