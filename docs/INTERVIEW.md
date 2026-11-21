# Interview guide: ClaimLens

Use this to talk about the project accurately under questioning. Everything here is verifiable in the repository; do not claim more than the evidence supports.

## 60-second pitch

ClaimLens is a local-first fact-checking tool. It retrieves web evidence with Tavily, asks Gemini to propose an evidence-grounded analysis, then lets deterministic server-side policy reject unsupported conclusions before anything is shown to the user. Findings are TRUE, FALSE, MIXED or UNVERIFIED with verbatim source excerpts. It ships as a typed React dashboard, an Express API with SSE streaming and cancellation, and a Manifest V3 extension. History lives in the browser, not a database. The engineering emphasis is grounding, safety and honesty about uncertainty rather than a confident-looking verdict.

## What to emphasize

- **Grounding is enforced, not prompted.** Citations reference registered excerpts; the server substitutes verbatim text and rejects invented references. Changed numbers and flipped negation are caught by quote review. See ADR-001.
- **Policy is a separate layer.** Independent-source counts, affiliated-domain grouping, freshness rules and subjective/future abstention are deterministic code with direct tests, not model behaviour.
- **Real security engineering.** SSRF-resistant URL validation with property tests, prompt-injection delimiters, strict schemas, bounded bodies, CORS allowlisting, rate limiting, sanitized errors and no submitted text in logs. See ADR-002.
- **A meaningful verification gate.** 77 Node tests (including 13 for the extension), 7 Playwright specs, strict TypeScript, lint, build, dependency audit, dataset integrity validation. CI runs all of it except the container image.
- **Honest reporting.** The status document explicitly says accuracy is unmeasured and Docker was not run. That is a strength if you own it.

## Likely questions and candid answers

**"Where does the AI end and your code begin?"**
The model generates search queries and proposes a structured analysis from supplied evidence; it does not decide whether the evidence is admissible. My code controls retrieval, source registration, quote verification, independence/freshness policy and the final verdict mapping. Provider failure produces an error, never a guess.

**"Isn't the keyword rule in `mock.ts` cheating?"**
It exists only in `createMockProviders()` for the offline demo and test fixtures, is gated by demo mode, and displays a visible TEST_MODE banner. The live path never calls it. There is a test literally named "provider outage surfaces an error and never invokes keyword scoring".

**"How accurate is it?"**
Unknown. A 130-case FEVER-derived dataset with recorded provenance is included and `npm run eval:validate` verifies its integrity, but no real-provider baseline has been measured. I would not quote an accuracy number without that run.

**"Why no database?"**
It is not needed for the core use case and would add accounts, retention policy and migration burden. Reports stay in localStorage; opt-in SQLite/Postgres share links sit behind one `Store` interface when needed.

**"What is the biggest weakness?"**
The 968-line `Dashboard.tsx` is a god component and the real-provider accuracy gap is unresolved. Also, persistence delete/transaction paths and a result deep link in the extension are not implemented.

**"Why are there two Vercel configs and three extension copies?"**
Both repository-root and `apps/web` deployments are supported; each has a `vercel.json`. The extension has a source directory and generated packaged copies for loading unpacked. That is redundant and a cleanup candidate.

## Demo script (no API keys needed)

```sh
npm ci
npm run check
npm run eval:validate
npm run e2e
npm run build && npm run preview:test   # http://127.0.0.1:18089
```

Try `no evidence for this claim`, `provider quota for this claim`, and `slow check for this claim` to exercise abstention, error recovery and cancellation.

## Known gaps — say them before you are asked

- No measured accuracy baseline; no real-provider integration test.
- Docker image defined but not executed here (no Docker/Podman/WSL).
- No tests for the SQL adapters; the extension package itself has 13 automated tests plus a manual Chromium load.
- Large dashboard component; decorative "protocol/telemetry" styling may read as style-over-substance.
- Local `.env` contains credentials for local use; it is gitignored and absent from history, but must be rotated before sharing the working directory.

## What I would do next, in order

1. Run the FEVER-derived regression with real credentials and publish measured results, including failure categories.
2. Split `Dashboard.tsx` into focused components with the existing E2E suite as the safety net.
3. Add tests for persistence adapters and the extension bridge; add the remaining delete/transaction paths.
4. Deduplicate extension assets and remove legacy empty directories and shims that are no longer referenced.
5. Add a container build check to CI once a Docker-capable runner is available.
