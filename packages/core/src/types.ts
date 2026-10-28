import { z } from "zod";

export const CHANGE_SET_SCHEMA_VERSION = 1 as const;

export type ChangeStatus = "pending" | "applied" | "failed";

export interface SourceReference {
  file: string;
  line: number;
  method?: "explicit" | "css-rule" | "source-map" | "utility-class" | "component-runtime" | "component-style" | "component-token";
  confidence?: "exact" | "component";
  usageCount?: number;
  usageScope?: "single" | "shared" | "unknown";
}

export interface VisualChange {
  targetId?: string;
  property: string;
  before: string;
  after: string;
  source?: SourceReference;
}

export interface ElementContext {
  tagName: string;
  html?: string;
  text?: string;
  id?: string;
  classNames?: string[];
  role?: string;
  ariaLabel?: string;
}

export interface ChangeTarget {
  id?: string;
  selector: string;
  label: string;
  source?: SourceReference;
  context?: ElementContext;
  prompt?: string;
}

export interface ChangeSet {
  schemaVersion: typeof CHANGE_SET_SCHEMA_VERSION;
  id: string;
  sessionId: string;
  status: ChangeStatus;
  createdAt: string;
  origin?: "embedded" | "browser-overlay";
  prompt?: string;
  impactAcknowledged?: boolean;
  conversationClaimedAt?: string;
  conversationNotifiedAt?: string;
  workspace: string;
  pageUrl: string;
  pageTitle?: string;
  viewport: {
    width: number;
    height: number;
  };
  target: ChangeTarget;
  targets?: ChangeTarget[];
  changes: VisualChange[];
  result?: {
    summary: string;
    changedFiles: string[];
    verification: string[];
  };
}

export type NewChangeSet = Omit<
  ChangeSet,
  "schemaVersion" | "id" | "status" | "createdAt" | "conversationClaimedAt" | "conversationNotifiedAt" | "result"
>;

const sourceReferenceSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  method: z.enum(["explicit", "css-rule", "source-map", "utility-class", "component-runtime", "component-style", "component-token"]).optional(),
  confidence: z.enum(["exact", "component"]).optional(),
  usageCount: z.number().int().nonnegative().optional(),
  usageScope: z.enum(["single", "shared", "unknown"]).optional()
});

const elementContextSchema = z.object({
  tagName: z.string().min(1),
  html: z.string().max(1600).optional(),
  text: z.string().max(500).optional(),
  id: z.string().max(200).optional(),
  classNames: z.array(z.string().max(200)).max(20).optional(),
  role: z.string().max(100).optional(),
  ariaLabel: z.string().max(500).optional()
});

const changeTargetSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  selector: z.string().min(1),
  label: z.string().min(1),
  source: sourceReferenceSchema.optional(),
  context: elementContextSchema.optional(),
  prompt: z.string().trim().min(1).max(4000).optional()
});

export const newChangeSetSchema = z.object({
  sessionId: z.string().min(1),
  origin: z.enum(["embedded", "browser-overlay"]).optional(),
  prompt: z.string().trim().min(1).max(4000).optional(),
  impactAcknowledged: z.boolean().optional(),
  workspace: z.string().min(1),
  pageUrl: z.string().min(1),
  pageTitle: z.string().max(500).optional(),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }),
  target: changeTargetSchema,
  targets: z.array(changeTargetSchema).min(1).max(50).optional(),
  changes: z.array(
    z.object({ targetId: z.string().min(1).max(200).optional(), property: z.string().min(1), before: z.string(), after: z.string(), source: sourceReferenceSchema.optional() })
  ).default([])
}).refine((value) => value.changes.length > 0 || Boolean(value.prompt) || Boolean(value.targets?.some((target) => target.prompt)), {
  message: "A DOMTune request requires at least one visual change or a prompt."
});

export const changeSetSchema = newChangeSetSchema.extend({
  schemaVersion: z.literal(CHANGE_SET_SCHEMA_VERSION),
  id: z.string().regex(/^dt_[a-z0-9]+$/),
  status: z.enum(["pending", "applied", "failed"]),
  createdAt: z.string(),
  conversationClaimedAt: z.string().optional(),
  conversationNotifiedAt: z.string().optional(),
  result: z.object({
    summary: z.string(),
    changedFiles: z.array(z.string()),
    verification: z.array(z.string())
  }).optional()
});
