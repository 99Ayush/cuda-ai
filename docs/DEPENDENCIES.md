# Dependency decisions

No provider credentials are included in application packages. The lockfile pins exact resolved versions. These one-line justifications are intended for the upgrade's eventual PR description.

| Addition                                | Purpose                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and Node/React/Express types | Strict shared contracts and compile-time checking across API and web.                                                        |
| Zod                                     | One executable runtime contract for external model/API data and generated OpenAPI.                                           |
| tldts                                   | Maintained public-suffix parsing for independent-source grouping and canonical domains.                                      |
| Mozilla Readability and jsdom           | Extract public article text with a well-understood parser; page scripts never run.                                           |
| pg and its types                        | Optional Postgres persistence behind the same interface as local SQLite.                                                     |
| Prettier                                | Consistent formatting with a deterministic check.                                                                            |
| TypeScript ESLint parser/plugin         | Lint actual typed API, shared and React sources in addition to the strict compiler gate.                                     |
| Playwright                              | Real-browser web and extension contract tests, screenshots and interaction checks.                                           |
| fast-check                              | Property tests for URL safety and quotation validation.                                                                      |
| Prometheus metrics                      | Implemented as bounded counters/histograms without a new runtime dependency; the deprecated prom-client package was removed. |

SQLite uses Node's built-in database module. Queues, bounded TTL cache, token buckets, provider cancellation and budget accounting will use small local modules, avoiding extra services for localhost.
