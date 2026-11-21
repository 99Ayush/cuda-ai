# ADR-003: One compiled runtime, two deployment targets, browser-local state

**Status:** Accepted · **Date:** 2026-11-21

## Context

The service must run locally (`npm run dev`, `npm start`), as a Vercel serverless function from either the repository root or `apps/web`, and alongside a Chrome extension. Earlier revisions had duplicate JavaScript modules alongside TypeScript sources, which allowed the running code and the tested code to diverge.

## Decision

- **Single source of truth:** the Express app lives in `apps/api/src/app.ts` and is compiled to `apps/api/dist`. `apps/api/index.js`, `api/index.js` and `apps/web/api/index.js` are thin adapters that require the same compiled handler. Legacy JS/JSX runtime modules were deleted.
- **Shared contracts:** `packages/shared` holds Zod schemas and types used by both server and browser. `APP_VERSION` is exported there so health and OpenAPI cannot drift from the documented release.
- **Two frontends, one API:** the Vite dashboard talks same-origin by default; the Manifest V3 extension talks to the same API with an allowlisted `chrome-extension://` origin. The extension is packaged from source by `scripts/build-extension.js` rather than being an npm workspace.
- **State stays local:** reports are stored in browser localStorage; SQLite/Postgres are opt-in and sit behind one `Store` interface. The server does not persist submitted claims by default.
- **Fail closed on setup:** health reports `setup_required` without provider keys; readiness additionally checks store health, circuit state and queue capacity.

## Alternatives considered

- Keeping parallel JS and TS runtimes during migration: rejected because it let untested code paths reach production.
- A separate BFF for the extension: rejected as unnecessary; origin allowlisting plus the shared API is sufficient.
- Mandatory database: rejected because it adds accounts, retention policy and migration burden to a tool that is useful without them.

## Consequences

- `npm run check` is a meaningful gate: typecheck, 77 Node tests, lint and a full production build all exercise the same compiled runtime.
- Vercel's proxy topology is trusted for IP detection only in Vercel mode; local clients cannot spoof their apparent IP.
- The Docker image is defined but unverified on this host (no Docker/Podman/WSL). The Playwright suite runs locally and in CI; the real-provider benchmark still needs credentials.
- The 968-line `Dashboard.tsx` is known technical debt. It is covered by E2E tests but should be split into focused components before adding more view-level features.

## Verification

`apps/api/src/app.ts`, `apps/api/src/store.ts`, `packages/shared/src/index.ts`, `scripts/dev.js`, `scripts/build-extension.js`, `.github/workflows/ci.yml`, `docs/UPGRADE_STATUS.md`.
