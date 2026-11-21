# Audit artifacts

Most JSON and text files here are **point-in-time evidence snapshots** recorded on 20 November 2026, before the TypeScript runtime migration on 21 November 2026. They include `check.txt`, `coverage.txt`, `quality-results.json`, `probe-results.json` and `dependency-audit-status.json`. `secret-scan-results.json` was refreshed on 21 November 2026 after finalization: 11 commits scanned, no history hits, working-tree hits, tracked `.env` files or key-in-bundle hits.

Do not read their test counts, covered filenames or probe results as current. For example, `coverage.txt` reports 43 tests against the old `frontend/client/server/*.js` layout; the current suite has 64 Node tests plus 7 Playwright specs against `apps/api/src/*.ts` and `apps/web/src/*`.

Current, reproducible verification lives in [`../UPGRADE_STATUS.md`](../UPGRADE_STATUS.md) and is produced by:

```sh
npm run check
npm run eval:validate
npm run format:check
npm audit --audit-level=high
npm run e2e
```

The `*.cjs` files here are the scripts that produced the original snapshots. They are retained for provenance, not as part of the default check pipeline.
