import { z } from "zod";

/** Single source of truth for the API version reported by health and OpenAPI. */
export const APP_VERSION = "3.0.0";

export const VerdictSchema = z.enum(["TRUE", "FALSE", "MIXED", "UNVERIFIED"]);
export const ClaimKindSchema = z.enum(["FACTUAL", "QUESTION", "OPINION", "PREDICTION"]);
export const StanceSchema = z.enum(["SUPPORTS", "REFUTES", "CONTEXT"]);
export const StageSchema = z.enum([
  "normalizing",
  "extracting",
  "queries",
  "searching",
  "reading",
  "analyzing",
  "validating",
  "complete",
]);
export const QualitySchema = z.object({
  tier: z.enum(["primary", "reference", "news", "other"]),
  score: z.number().min(0).max(1),
  explanation: z.string(),
  independent_domain: z.string(),
  recent: z.boolean().nullable(),
});
export const SourceSchema = z
  .object({
    id: z.string().min(1),
    url: z.url().refine((value) => {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
    }, "Use a safe public source link"),
    title: z.string(),
    publisher: z.string(),
    content: z.string(),
    provider: z.string().optional(),
    published_at: z.string().nullable().optional(),
    retrieved_at: z.string().optional(),
    excerpts: z.array(z.object({ id: z.string(), quote: z.string() })).optional(),
    quality: QualitySchema.optional(),
  })
  .passthrough();
export const EvidenceSchema = z
  .object({
    source_id: z.string(),
    stance: StanceSchema,
    quote: z.string(),
    match: z.enum(["exact", "fuzzy"]).optional(),
    validity: z.number().min(0).max(1).optional(),
  })
  .strict();
export const FindingSchema = z
  .object({
    claim: z.string(),
    verdict: VerdictSchema,
    explanation: z.string(),
    evidence_strength: z.string(),
    evidence: z.array(EvidenceSchema).max(6),
    sources: z.array(SourceSchema).max(8),
    confidence: z.number().min(0).max(1).nullable().optional(),
    confidence_explanation: z.string().optional(),
    claim_kind: ClaimKindSchema.optional(),
    validation: z
      .object({
        submitted: z.number(),
        accepted: z.number(),
        rejected: z.number(),
        fuzzy_flagged: z.number(),
      })
      .optional(),
  })
  .refine(
    (row) => row.evidence.every((e) => row.sources.some((s) => s.id === e.source_id)),
    "Evidence must resolve to a supplied source",
  );
export const TraceSchema = z.object({
  stage: StageSchema,
  duration_ms: z.number().nonnegative(),
  detail: z.string().optional(),
});
export const ResultSchema = z
  .object({
    id: z.string().min(1).max(100),
    input: z.string().max(2048),
    input_type: z.enum(["claim", "article"]),
    verdict: VerdictSchema,
    summary: z.string(),
    checked_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
    latency_ms: z.number().nonnegative(),
    claims: z.array(FindingSchema).max(3),
    source_count: z.number().nonnegative().optional(),
    model: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    trace: z.array(TraceSchema).optional(),
    queries: z.array(z.array(z.string())).optional(),
    cached: z.boolean().optional(),
    cache_age_ms: z.number().nonnegative().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    usage: z
      .object({
        search_calls: z.number(),
        llm_calls: z.number(),
        input_tokens: z.number(),
        output_tokens: z.number(),
        estimated_cost_usd: z.number().nullable(),
      })
      .optional(),
    schema_version: z.literal(1).optional(),
    demo: z.boolean().optional(),
    permalink: z
      .string()
      .regex(/^\/shared\/[A-Za-z0-9_-]{32}$/)
      .optional(),
  })
  .refine(
    (row) =>
      row.claims.length > 0 || (row.input_type === "article" && row.verdict === "UNVERIFIED"),
    "An empty article result must abstain",
  );
export const EvidenceReferenceSchema = z
  .object({
    source_id: z.string(),
    excerpt_id: z.string().optional(),
    quote: z.string().optional(),
    stance: StanceSchema,
  })
  .strict()
  .refine((row) => Boolean(row.excerpt_id || row.quote), "Supply an excerpt or quote");
export const AnalysisSchema = z
  .object({
    claims: z
      .array(
        z
          .object({
            claim_index: z.number().int().nonnegative(),
            claim_kind: ClaimKindSchema,
            verdict: VerdictSchema,
            explanation: z.string().min(15).max(2500),
            confidence: z.number().min(0).max(1).optional(),
            evidence: z.array(EvidenceReferenceSchema).max(6),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
const options = {
  recheck: z.boolean().optional(),
  persist: z.boolean().optional(),
  selectedClaims: z.array(z.string().min(8).max(2000)).min(1).max(3).optional(),
};
export const CheckInputSchema = z.union([
  z.object({ text: z.string().trim().min(8).max(2000), ...options }).strict(),
  z.object({ pageUrl: z.string().trim().min(1).max(2048), ...options }).strict(),
]);
export const ExtractionSchema = z
  .object({ claims: z.array(z.string().trim().min(8).max(2000)).max(3) })
  .strict();
export const ScreenSchema = z
  .object({
    text: z.string().max(6000),
    claims: z.array(z.string().trim().min(8).max(2000)).max(3),
  })
  .strict();
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  error: z.string().optional(),
  request_id: z.string().optional(),
});
export const HealthSchema = z.object({
  status: z.enum(["ready", "setup_required", "degraded", "checking", "unreachable"]),
  configured: z
    .object({
      evidence: z.boolean(),
      analysis: z.boolean(),
      google: z.boolean().optional(),
      google_mode: z.string().optional(),
    })
    .optional(),
  test_mode: z.boolean().optional(),
  version: z.string().optional(),
  history: z.string().optional(),
  persistence: z.boolean().optional(),
});
export type Verdict = z.infer<typeof VerdictSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Result = z.infer<typeof ResultSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type CheckInput = z.infer<typeof CheckInputSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type Health = z.infer<typeof HealthSchema>;
export type ProgressEvent = { stage: Stage; detail: string; elapsed_ms: number };
export function validResult(value: unknown): value is Result {
  return ResultSchema.safeParse(value).success;
}
