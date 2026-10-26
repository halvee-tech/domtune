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
      method?: "explicit" | "css-rule" | "source-map" | "utility-class";
      confidence?: "exact";
    };
  };
  changes: Array<{
    property: string;
    before: string;
    after: string;
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
7. `source.method` records whether the producer used an explicit source hint, a unique source-map position, a unique matching CSS rule, or a uniquely located static utility class. Producers must not mark ambiguous candidates as `exact`.
