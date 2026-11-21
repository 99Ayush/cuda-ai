# ADR-002: Security boundaries for untrusted web and model input

**Status:** Accepted · **Date:** 2026-11-21

## Context

The product accepts user-supplied claims and article URLs, fetches remote pages, and passes retrieved text to an LLM. That creates three attacker-controlled channels: the URL (SSRF), the page/model text (prompt injection), and the HTTP API itself (origin abuse, oversized bodies, credential leakage).

## Decision

- **Safe fetching:** `apps/api/src/url.ts` resolves DNS and rejects private, loopback, link-local and mapped IPv6 addresses on every resolved answer. Fetches are pinned to a validated IP, redirects are revalidated with a three-hop cap, and content type and size are bounded. The DOM is parsed with JSDOM scripting disabled before Readability extraction.
- **Untrusted content is delimited:** provider prompts mark all retrieved content as untrusted, wrap it in `<untrusted_input_json>` with `<` escaped, and repeat task-specific instructions after the data. No tool-calling capability is exposed to the model.
- **API hardening:** strict Zod schemas, 16 KB claim bodies (6 MB for screenshot data URLs), request IDs, sanitized JSON errors, optional client API keys, a 10/minute-per-IP token bucket, a bounded admission queue, and security headers/CSP in production. `X-Forwarded-For` is trusted only on Vercel, not from local clients.
- **Credential hygiene:** provider keys stay server-side in headers, are loaded from environment or gitignored `.env` files, never enter logs, and are absent from committed history. `docs/audit/secret-scan.cjs` exists as a manual check.
- **Privacy by default:** no global server history; up to 50 reports live in the browser's localStorage. `/api/history` is a compatibility stub returning an empty array. Share links are opt-in and time-limited when persistence is enabled.

## Alternatives considered

- Fetching arbitrary user URLs directly in the browser: simpler, but exposes users to CORS inconsistencies and gives the application no control over redirects or content size. Extraction is delegated to Tavily for article URLs.
- Trusting model output verbatim: rejected for the grounding reasons in ADR-001.
- Server-side history by default: rejected because it would require accounts and create a new data-retention surface without a product need.

## Consequences

- Security code is substantial and is property-tested (IP blocking and URL canonicalisation), which is deliberate rather than incidental.
- Optional auth means a public deployment should be fronted by Vercel Firewall or an equivalent edge control and provider spending limits; this is documented in the README rather than pretended away.
- Local `.env` files can contain live credentials. They are gitignored, but must be rotated before the working directory is shared and should never be committed.

## Verification

`apps/api/src/url.ts`, `apps/api/src/providers.ts`, `apps/api/src/app.ts`, `apps/api/tests/app.test.js`, `apps/api/tests/stages.test.cjs`, `apps/api/tests/features.test.js`.
