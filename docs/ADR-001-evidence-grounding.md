# ADR-001: Evidence-grounded verdicts with deterministic abstention

**Status:** Accepted · **Date:** 2026-11-21

## Context

Verity emits verdicts about real-world claims. A naive implementation can look convincing while failing in three ways: the model invents quotes, it treats a single low-quality page as proof, or it answers subjective and future claims as if they were empirically verifiable. Any of these would make the product worse than useless: users would trust a confident but ungrounded verdict.

We needed a pipeline where the language model proposes an analysis, but the server decides whether that analysis is admissible.

## Decision

1. **Search first, judge second.** Tavily retrieves evidence for generated queries; the model never sees the claim in isolation at verdict time.
2. **Registered source excerpts.** Every citation refers to a source ID and excerpt ID created by the retrieval layer. The server replaces those references with the stored verbatim text. Unknown IDs cannot establish a finding.
3. **Quote verification.** A quoted excerpt must match retrieved content. Fuzzy comparison rejects changed numbers and flipped negation rather than accepting approximate strings.
4. **Deterministic abstention policy.** `validateAnalysis()` and `calibrate()` downgrade or reject findings when the stance is unsupported, fewer than the configured number of independent sources agree, a source is affiliated with the claim subject, or time-sensitive evidence is stale. Opinions and unresolved predictions are reported as UNVERIFIED.
5. **Errors are errors.** Provider outages, quota failures, invalid JSON and timeouts return explicit retryable errors; they never silently fall back to keyword scoring or an absence-of-evidence verdict.
6. **No confidence percentages.** The UI reports evidence coverage and verdicts, not an uncalibrated numeric confidence.

## Alternatives considered

- **Keyword/heuristic verdicts:** fast and deterministic, but not genuinely fact checking. Kept only in the clearly labelled offline demo fixture (`apps/api/src/mock.ts`), never in the live path.
- **Trust the model's plain-text verdict:** simpler, but allows fabricated citations and ungrounded confidence. Rejected.
- **Embedding similarity alone as grounding:** tolerant of paraphrase but also of negation and numeric drift. Used only as a fuzzy review signal after exact-match rules, never as sole authority.

## Consequences

- The system is conservative: it abstains more often than a model-only approach and can be slower due to multiple searches and one repair attempt.
- Policy code is a meaningful part of the codebase and must be tested directly; 114 Node tests include dedicated abstention, citation-invention and quote-tampering cases, including property-based tests via `fast-check`.
- Accuracy is **not measured** against the FEVER-derived dataset yet. Dataset integrity is checked offline by `npm run eval:validate`; a real-provider baseline remains required before any accuracy claim.

## Verification

`apps/api/src/engine.ts`, `apps/api/src/sources.ts`, `apps/api/src/quotes.ts`, `apps/api/tests/engine.test.js`, `apps/api/tests/stages.test.cjs`, `eval/validate-dataset.cjs`.
