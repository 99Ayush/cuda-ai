# ClaimLens upgrade status

Finalized 21 November 2026 (Asia/Calcutta). Working repository: `C:/Users/master/Documents/Codex/2026-11-17/in-x20/work/cuda-ai`, branch `feat/working-fact-checker`, remote `origin` at `https://github.com/99Ayush/cuda-ai.git`. The pre-upgrade baseline is preserved in commit `0029451`; the audit precedes it in `c306881`.

This run was limited to localhost work by the user. No deployment or cloud account changes were made.

## Verified state

Commands were run from the repository root with Node `v22.23.2` and npm `11.13.0`.

- `npm run check` passes: strict typecheck, 64/64 tests, lint and production build of shared, API, web and extension.
- `npm audit --audit-level=high` reports 0 vulnerabilities.
- `npm run format:check` passes after one repository-wide Prettier normalization.
- `npm run e2e` passes 7/7 Playwright specs against the offline demo server on 21 November 2026 using the locally installed Chromium kernel (17.4 s). This is browser-level verification of the fixture UI, not provider accuracy.
- `npm run eval:validate` passes 11 deterministic integrity checks over the 130-case FEVER-derived dataset and its provenance record. It validates structure and labelling provenance; it does not measure accuracy.
- The runtime is `node apps/api/dist/index.js`. The legacy JavaScript runtime modules were removed; `apps/api/index.js`, the dev script and the tests all target compiled TypeScript.
- The local server is listening on `127.0.0.1:8080`. `GET /api/health` returns 200 with `status: ready`, evidence and analysis configured, `history: browser`, `persistence: false`. The built UI is served at `http://localhost:8080`.
- Local smoke check on 21 November 2026: 60 sequential `GET /api/health` requests, 60 successes, p50 7.9 ms, p95 11.2 ms, max 88.7 ms. This measures localhost liveness only. It is not a capacity benchmark or an accuracy measurement.

No factual performance score, accuracy figure or completion claim beyond these observations is made.

## What is in place

- **Foundation and migration (Phase 0):** npm workspaces for `apps/api`, `apps/web` and `packages/shared`, with the extension packaged as static assets by `scripts/build-extension.js` (it is not an npm workspace); strict TypeScript contracts shared by server and browser; single compiled runtime; obsolete duplicate JS modules deleted.
- **Evidence pipeline (Phase 1):** atomic claim extraction and picker, diverse and counter queries, canonical URLs and affiliated-owner grouping, source quality and recency, owner-based independence and abstention, strict schemas, verbatim quote validation with fuzzy review, controlled provider mocks and bounded TTL cache.
- **API (Phase 2):** `/api/v1` JSON and SSE routes, real disconnect cancellation, admission queue and token buckets, provider retries and circuits, response bounds, SQLite and Postgres adapters behind one store interface, generated OpenAPI, metrics, config and readiness endpoints.
- **Security (Phase 3):** DNS validation with private and mapped-address blocking, pinned fetches, bounded redirects, body and content-type limits, production headers and extension-only CORS.
- **Evaluation data (Phase 4):** `eval/build-dataset.cjs` builds a FEVER-derived dataset with recorded source revision, SHA-256, licence and category counts into `eval/data/`. It was built earlier in this workspace. No measured baseline comparison was produced locally.
- **Website (Phase 5):** dark dashboard with shared design tokens, typed streaming results, evidence display, local history and statistics, cancellation, accessibility-oriented markup and copy/export controls.
- **Extension (Phase 6):** Manifest V3 side panel, selected text, context menu, local screenshot capture with reviewed reading claims, cancellation and failure handling, and a separate local text-report history.
- **Contracts and CI (Phase 7):** 64 node tests cover routes, validation, provider behaviour, evidence grounding, cancellation, storage and OpenAPI. GitHub Actions has a `check` job (`npm run check`, dataset validation, dependency audit) and an `e2e` job that installs Chromium and runs the 7 Playwright specs. All specs were also executed locally during finalization.
- **Local container (Phase 8):** `Dockerfile` and `docker-compose.yml` added for a Node 24 runtime with optional Postgres profile. Docker, Podman and WSL are absent on this host, so image execution remains unverified.
- **Documentation (Phase 9):** `AUDIT.md`, `docs/audit/` (with a note that its snapshots predate the migration), `docs/DEPENDENCIES.md`, three `docs/ADR-*.md` records, `docs/INTERVIEW.md`, README, extension guide and this status record the architecture, decisions, interview trade-offs, audit evidence and verification commands.

## Remaining work

- Run the FEVER-derived regression against real provider credentials and record measured results before making accuracy claims. Dataset integrity is validated offline; accuracy is not.
- Execute the container image on a host with Docker or Podman and run the localhost load test, including the optional Postgres profile.
- Add the remaining database transaction and delete paths, extension popover and result deep link if those features are wanted.
- Keep `docs/ADR-*.md` and `docs/INTERVIEW.md` current when architecture or trade-offs change.
- Keep the repository on this verified checkpoint by running `npm run check` and `npm audit --audit-level=high` before each merge. The pre-commit hook runs typecheck, lint and formatting checks.

## Reproduce

```sh
npm ci
npm run check
npm run format:check
npm run eval:validate
npm audit --audit-level=high
npm run e2e          # requires a Playwright Chromium kernel
npm run dev          # UI on http://localhost:5173, API on 8080
```

With no provider credentials, `npm run build && npm run preview:test` serves controlled fixtures on `http://127.0.0.1:18081` with a test-data banner.
