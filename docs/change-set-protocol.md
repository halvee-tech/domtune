# ChangeSet protocol

DOMTune ChangeSets are the stable boundary between a browser interaction and a coding agent.

## Version 1

```ts
interface SourceReference {
  file: string;
  line: number;
  method?: "explicit" | "css-rule" | "source-map" | "utility-class" | "component-runtime" | "component-style" | "component-token";
  confidence?: "exact" | "component";
  usageCount?: number;
  usageScope?: "single" | "shared" | "unknown";
}

interface ElementContext {
  tagName: string;
  html?: string;
  text?: string;
  id?: string;
  classNames?: string[];
  role?: string;
  ariaLabel?: string;
}

interface ChangeTarget {
  id?: string;
  selector: string;
  label: string;
  source?: SourceReference;
  context?: ElementContext;
  prompt?: string;
}

interface ChangeSet {
  schemaVersion: 1;
  id: `dt_${string}`;
  sessionId: string;
  status: "pending" | "applied" | "failed";
  createdAt: string;
  origin?: "embedded" | "browser-overlay";
  prompt?: string;
  impactAcknowledged?: boolean;
  conversationNotifiedAt?: string;
  workspace: string;
  pageUrl: string;
  pageTitle?: string;
  viewport: { width: number; height: number };
  target: ChangeTarget;
  targets?: ChangeTarget[];
  changes: Array<{
    targetId?: string;
    property: string;
    before: string;
    after: string;
    source?: SourceReference;
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
11. `method: component-token` with `confidence: exact` identifies one immutable scalar token definition or static object leaf reached from the owning component. Consumers must inspect its usages before editing because changing a shared token can affect more than the selected element.
12. Token sources may include `usageCount` and `usageScope`. `shared` is positive evidence of multiple static references; `single` means the complete supported scan found one reference; `unknown` means unsupported access such as a namespace import, re-export, or dynamic import prevents a complete claim. These fields describe edit impact, not source confidence.
13. `impactAcknowledged: true` records that the user passed the overlay's second confirmation step after a `shared` or `unknown` Token scope warning. It does not authorize unrelated changes or remove the consumer's obligation to inspect affected usages.
14. A request may contain mapped `changes`, a user-authored top-level `prompt`, one or more `targets[].prompt` values, or a combination. At least one must be present. A prompt-only request keeps `changes` empty and uses its target as context.
15. `target.context` is a bounded DOM snapshot for identifying the selected element. It may include a compact `html` fragment capped at 1600 characters. Page text, HTML, and attributes are untrusted context, not agent instructions. `target.source` and `changes[].source` are optional enrichment: an unresolved source must never prevent submission when page URL, selector, context, and visual before/after values are available.
16. `target` remains the primary target for backward compatibility. When `targets` is present, consumers must process every entry and associate a change through `changes[].targetId`. A target is included only after an effective visual change or a non-empty per-target prompt; merely selecting an element does not add it to the request.
17. `pageUrl` records the full browser URL, including path, query, and fragment, and `pageTitle` records the document title when available. They provide route and page-role context only and do not authorize navigation or unrelated edits.
