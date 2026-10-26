import { z } from "zod";

export const CHANGE_SET_SCHEMA_VERSION = 1 as const;

export type ChangeStatus = "pending" | "applied" | "failed";

export interface SourceReference {
  file: string;
  line: number;
  method?: "explicit" | "css-rule" | "source-map" | "utility-class";
  confidence?: "exact";
}

export interface VisualChange {
  property: string;
  before: string;
  after: string;
  source?: SourceReference;
}

export interface ChangeSet {
  schemaVersion: typeof CHANGE_SET_SCHEMA_VERSION;
  id: string;
  sessionId: string;
  status: ChangeStatus;
  createdAt: string;
  origin?: "embedded" | "browser-overlay";
  conversationNotifiedAt?: string;
  workspace: string;
  pageUrl: string;
  viewport: {
    width: number;
    height: number;
  };
  target: {
    selector: string;
    label: string;
    source: SourceReference;
  };
  changes: VisualChange[];
  result?: {
    summary: string;
    changedFiles: string[];
    verification: string[];
  };
}

export type NewChangeSet = Omit<
  ChangeSet,
  "schemaVersion" | "id" | "status" | "createdAt" | "conversationNotifiedAt" | "result"
>;

const sourceReferenceSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  method: z.enum(["explicit", "css-rule", "source-map", "utility-class"]).optional(),
  confidence: z.literal("exact").optional()
});

export const newChangeSetSchema = z.object({
  sessionId: z.string().min(1),
  origin: z.enum(["embedded", "browser-overlay"]).optional(),
  workspace: z.string().min(1),
  pageUrl: z.string().min(1),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }),
  target: z.object({
    selector: z.string().min(1),
    label: z.string().min(1),
    source: sourceReferenceSchema
  }),
  changes: z.array(
    z.object({ property: z.string().min(1), before: z.string(), after: z.string(), source: sourceReferenceSchema.optional() })
  ).min(1)
});

export const changeSetSchema = newChangeSetSchema.extend({
  schemaVersion: z.literal(CHANGE_SET_SCHEMA_VERSION),
  id: z.string().regex(/^dt_[a-z0-9]+$/),
  status: z.enum(["pending", "applied", "failed"]),
  createdAt: z.string(),
  conversationNotifiedAt: z.string().optional(),
  result: z.object({
    summary: z.string(),
    changedFiles: z.array(z.string()),
    verification: z.array(z.string())
  }).optional()
});
