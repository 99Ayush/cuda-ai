# Verity

A fact-checking website for claims and public articles. It retrieves web evidence with Tavily and uses Gemini to compare that evidence with the claim. Findings use the contract values **TRUE**, **FALSE**, **MIXED**, or **UNVERIFIED** (shown in the UI as Supported, Refuted, Mixed findings, or Unverified), with exact source excerpts and links.

The website does not generate a true/false verdict from keywords or the absence of evidence. Every cited source ID and quotation is checked against retrieved content. AI judgments can still be wrong; users should read the original sources.

## Run locally

Use Node.js 22.12 or newer. From the repository root:

```sh
npm ci
npm run dev
```

The UI opens at http://localhost:5173. The API listens on port 8080, and Vite proxies /api requests to it. To serve the built website with Node:

```sh
npm run build
npm start
```

The built website is then available at http://localhost:8080.

To review the interface without provider credentials, run `npm run build` followed by `npm run preview:test`. Open http://127.0.0.1:18089. This local-only preview uses controlled provider fixtures and displays a test-data banner; it does not perform live fact checks. It exercises claim and article results, missing evidence, unreadable articles, provider errors and cancellation. Example fixture inputs include `no evidence for this claim`, `provider unavailable for this claim`, `provider quota for this claim`, and `slow check for this claim`.

Configure GEMINI*API_KEY and TAVILY_API_KEY in your environment. The server also loads local .env files at the repository root, apps/api, or apps/web; existing environment variables take precedence. The root .env.example documents the configuration. Do not put provider secrets in VITE* variables or commit them.

| Setting         | Purpose                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| GEMINI_API_KEY  | Required server-side Gemini credential                                                |
| TAVILY_API_KEY  | Required server-side Tavily credential                                                |
| GEMINI_MODEL    | Optional model override; defaults to gemini-3.5-flash-lite                            |
| PORT            | Local backend port; defaults to 8080. The default dev proxy expects 8080.             |
| ALLOWED_ORIGINS | Optional comma-separated origins for a separately hosted UI                           |
| VITE_API_URL    | Optional API origin for a separately hosted UI; omit for same-origin Vercel/local use |

Gemini 2.5 Flash is deprecated and is limited to existing users until December 1, 2026. The default uses its documented successor. See [Google's model guidance](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash).

## Deploy on Vercel

Connect the GitHub repository to your existing Vercel project. Both the **repository root** and **apps/web** are supported project root directories. Their vercel.json files build the Vite UI and route API requests to the same serverless Express handler.

- Add GEMINI_API_KEY and TAVILY_API_KEY as server-side environment variables. Enable them for the environments you intend to test: Preview and Production.
- Use Vite as the framework preset and a supported Node version of 22 or later.
- For repository-root deployments, the output directory is apps/web/dist. For apps/web deployments, it is dist.
- Remove old project-level command/output overrides if they contradict the committed configuration.
- Redeploy after changing environment variables. Existing deployments do not receive new values automatically.
- Verify /api/health and submit a real claim after deployment. A health response of ready confirms configuration presence, not provider credentials or available quota.

The server lives inside apps/api/src so a Vercel project rooted at apps/web can trace all its runtime sources. apps/api/index.js remains the local Node entry point. The root and frontend API adapters share the same implementation.

## Behavior and privacy

- **Claim checks:** accept one specific claim, 8–2,000 characters.
- **Article checks:** Tavily extracts public article text. Gemini selects up to three key factual claims, which are searched and checked separately. The input publisher is excluded from evidence searches to avoid circular confirmation.
- **Evidence:** duplicate and unsafe URLs are removed. Invalid model fields are rejected; invented source IDs and non-matching quotes cannot establish a verdict.
- **Uncertainty:** no evidence yields Unverified. Provider outages, quota failures and invalid output produce clear retryable errors; they do not become fabricated findings.
- **History:** up to 50 validated reports are stored in this browser's localStorage, with search, individual deletion, clearing and JSON export. There is no account or cross-device synchronization. Anyone using this browser profile can see its history.
- **Provider processing:** claim text and extracted article text are sent to Tavily and Gemini as part of analysis. The application does not keep a global server history or log submitted text/API keys.
- **Security:** same-origin API access by default, bounded JSON input, public-domain URL validation, safe citation links and safe JSON errors. The backend resolves and pins public article addresses, checks redirects, and bounds downloaded and decompressed content before extraction.
- **Usage limits:** 10 checks per minute per IP per function instance. Vercel's proxy topology is trusted only when running on Vercel; local clients cannot choose their apparent IP. For substantial public traffic, configure shared rate limits, Vercel Firewall and provider spending limits.
- **Provider availability:** temporary network failures and upstream 408/500/502/503/504 responses are retried once within the existing deadline. Busy, unavailable or timed-out Gemini models can use configured fallbacks with the same evidence. Authentication and quota failures return explicit errors without retries or model switching.
- **Scope:** text and article fact checking, plus extraction of visible claims from screenshots. Image authenticity, videos, deepfake detection and emergency coordination are outside this release.

The UI uses a dark editorial evidence desk with separate claim entry and source reading, serif typography, concise copy, and responsive navigation. Results put quoted evidence and source links first. History and activity reflect checks saved in this browser. The interface does not display uncalibrated model percentages or decorative system telemetry.

## API

| Method | Endpoint            | Behavior                                                                              |
| ------ | ------------------- | ------------------------------------------------------------------------------------- |
| GET    | /api/health         | Configuration readiness                                                               |
| POST   | /api/analyze-claim  | JSON body with either text or pageUrl                                                 |
| POST   | /api/extract-screen | PNG/JPEG data URL in image; returns visible text and up to three editable claims      |
| GET    | /api/history        | Compatibility endpoint returning an empty array; private history stays in the browser |

Legacy /health, /analyze-claim and /history paths remain available. API responses use Cache-Control: no-store.

```json
{ "text": "Lightning never strikes the same place twice." }
```

A report contains id, input, input_type, verdict, summary, claims, source_count, checked_at, latency_ms, actual model and provider warnings. Each claim contains its verdict, explanation, evidence_strength, exact quoted evidence and retrieved source metadata. Citations select registered source excerpts; the server inserts their verbatim text and rejects unknown references. Invalid evidence gets one repair attempt against the same sources. Opinions and unresolved predictions remain unverified. No numeric confidence is claimed.

## Validate changes

```sh
npm run check
npm run eval:validate
npm audit
npm run e2e          # needs a Playwright Chromium kernel; runs against the offline demo server
```

The Node tests cover HTTP routes, validation, provider outages, evidence grounding, article extraction, private history, rate limiting, corrupted browser storage, and the extension's manifest, panel, background worker and website bridge. They use injected provider fixtures and never require real API keys. `npm run eval:validate` checks the 130-case FEVER-derived dataset and its recorded provenance offline; it does not measure accuracy. The Playwright specs cover the fixture UI, cancellation, recovery, export/import, keyboard shortcuts and responsive layout. GitHub Actions runs a `check` job (tests, lint, build, dataset validation, dependency audit) and an `e2e` job on pull requests and main.

## Optional browser extension

Settings includes a downloadable extension ZIP. Run `npm run extension:build` or `npm run build`, extract `apps/web/public/verity-extension.zip`, and load its folder through Chrome/Edge’s **Load unpacked**. You can also load `apps/extension` directly. The extension’s Preferences section has been removed.

Click the toolbar icon, choose **Search on screen**, and drag over a claim. Releasing the mouse crops the selected area, automatically extracts its claim, fills the field, and starts checking. Use selected text also starts checking automatically; right-click selection remains supported. After navigating to a new site, click the toolbar icon there to grant temporary page access. Closing the website does not disable the extension. Keep the browser and local backend running.

The extension stores up to 20 text reports locally and never stores screenshots. Reload the unpacked extension after updating its files. Public one-click installation requires a Chrome Web Store or Edge Add-ons listing; the current ZIP supports development installation. See the [extension guide](apps/extension/README.md).

The server tries `GEMINI_FALLBACK_MODEL` when the primary model is busy or unavailable, preserving citation validation. Authentication and quota failures do not trigger model switching. `PUBMED_ENABLED=true` routes health claims to PubMed abstracts and excludes marked retracted publications. `WIKIDATA_ENABLED=true` grounds named entities through Wikidata, using a 24-hour entity cache and a 5-second request timeout. Configure `WIKIDATA_CONTACT_EMAIL` for its User-Agent. These are supporting evidence signals; provider outages retain available evidence and appear as warnings. API keys never reach the frontend or extension.

`npm run benchmark` runs 30 real-provider cases against `BENCHMARK_URL` (default http://127.0.0.1:8080), writing to `work/benchmark-results.json` unless `BENCHMARK_OUTPUT` is set. It reports quotation counts and distinguishes citation-free abstention from evidence-free definitive verdicts. Retries are bounded and respect rate-limit responses. These are regression examples, not a general accuracy estimate.

## License

MIT.
