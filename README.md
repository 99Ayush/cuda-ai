# CUDA AI

A fact-checking website for claims and public articles. It retrieves web evidence with Tavily and uses Gemini to compare that evidence with the claim. Findings are **Supported**, **Refuted**, **Mixed findings**, or **Unverified**, with exact source excerpts and links.

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

To review the interface without provider credentials, run `npm run build` followed by `npm run preview:test`. Open http://127.0.0.1:18081. This local-only preview uses controlled provider fixtures and displays a test-data banner; it does not perform live fact checks. It exercises claim and article results, missing evidence, unreadable articles, provider errors and cancellation. Example fixture inputs include `no evidence for this claim`, `provider unavailable for this claim`, `provider quota for this claim`, and `slow check for this claim`.

Configure GEMINI*API_KEY and TAVILY_API_KEY in your environment. The server also loads local .env files at the repository root, backend/api, or frontend/client; existing environment variables take precedence. The root .env.example documents the configuration. Do not put provider secrets in VITE* variables or commit them.

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

Connect the GitHub repository to your existing Vercel project. Both the **repository root** and **frontend/client** are supported project root directories. Their vercel.json files build the Vite UI and route API requests to the same serverless Express handler.

- Add GEMINI_API_KEY and TAVILY_API_KEY as server-side environment variables. Enable them for the environments you intend to test: Preview and Production.
- Use Vite as the framework preset and a supported Node version of 22 or later.
- For repository-root deployments, the output directory is frontend/client/dist. For frontend/client deployments, it is dist.
- Remove old project-level command/output overrides if they contradict the committed configuration.
- Redeploy after changing environment variables. Existing deployments do not receive new values automatically.
- Verify /api/health and submit a real claim after deployment. A health response of ready confirms configuration presence, not provider credentials or available quota.

The server lives inside frontend/client/server so a Vercel project rooted at frontend/client can trace all its runtime sources. backend/api/index.js remains the local Node entry point. The root and frontend API adapters share the same implementation.

## Behavior and privacy

- **Claim checks:** accept one specific claim, 8–2,000 characters.
- **Article checks:** Tavily extracts public article text. Gemini selects up to three key factual claims, which are searched and checked separately. The input publisher is excluded from evidence searches to avoid circular confirmation.
- **Evidence:** duplicate and unsafe URLs are removed. Invalid model fields are rejected; invented source IDs and non-matching quotes cannot establish a verdict.
- **Uncertainty:** no evidence yields Unverified. Provider outages, quota failures and invalid output produce clear retryable errors; they do not become fabricated findings.
- **History:** up to 50 validated reports are stored in this browser's localStorage, with search, individual deletion, clearing and JSON export. There is no account or cross-device synchronization. Anyone using this browser profile can see its history.
- **Provider processing:** claim text and extracted article text are sent to Tavily and Gemini as part of analysis. The application does not keep a global server history or log submitted text/API keys.
- **Security:** same-origin API access by default, bounded JSON input, public-domain URL validation, safe citation links and safe JSON errors. The app never directly fetches arbitrary user URLs; extraction is delegated to Tavily.
- **Usage limits:** 10 checks per minute per IP per function instance. Vercel's proxy topology is trusted only when running on Vercel; local clients cannot choose their apparent IP. For substantial public traffic, configure shared rate limits, Vercel Firewall and provider spending limits.
- **Provider availability:** temporary network failures and upstream 408/500/502/503/504 responses are retried once within the existing deadline. Busy, unavailable or timed-out Gemini models can use configured fallbacks with the same evidence. Authentication and quota failures return explicit errors without retries or model switching.
- **Scope:** text and article fact checking, plus extraction of visible claims from screenshots. Image authenticity, videos, deepfake detection and emergency coordination are outside this release.

The UI restores the original dark dashboard: navigation rail, compact claim-or-URL search, radar standby frame and telemetry sidebar. History and Stats use this browser's saved reports. Telemetry shows configuration readiness, measured scan latency and local archive usage. The UI shows evidence coverage rather than uncalibrated confidence percentages.

## API

| Method | Endpoint           | Behavior                                                                              |
| ------ | ------------------ | ------------------------------------------------------------------------------------- |
| GET    | /api/health        | Configuration readiness                                                               |
| POST   | /api/analyze-claim | JSON body with either text or pageUrl                                                 |
| POST   | /api/extract-screen | PNG/JPEG data URL in image; returns visible text and up to three editable claims |
| GET    | /api/history       | Compatibility endpoint returning an empty array; private history stays in the browser |

Legacy /health, /analyze-claim and /history paths remain available. API responses use Cache-Control: no-store.

```json
{ "text": "Lightning never strikes the same place twice." }
```

A report contains id, input, input_type, verdict, summary, claims, source_count, checked_at, latency_ms, actual model and provider warnings. Each claim contains its verdict, explanation, evidence_strength, exact quoted evidence and retrieved source metadata. Citations select registered source excerpts; the server inserts their verbatim text and rejects unknown references. Invalid evidence gets one repair attempt against the same sources. Opinions and unresolved predictions remain unverified. No numeric confidence is claimed.

## Validate changes

```sh
npm run check
npm audit
```

The Node tests cover HTTP routes, validation, provider outages, evidence grounding, article extraction, private history, rate limiting and corrupted browser storage. They use injected provider fixtures and never require real API keys. GitHub Actions runs tests, lint, build and the dependency audit on pull requests and main.

## Optional browser extension

Settings includes **Add as extension**, a downloadable installable ZIP, connection controls and a persistent screen-checking switch. Run `npm run extension:build` or `npm run build`, extract `frontend/client/public/cuda-ai-extension.zip`, and load its folder through Chrome/Edge’s **Load unpacked**. You can also load `frontend/client/extension` directly.

Click the toolbar icon to open the independent side panel. **Capture screen** captures the visible page locally; **Read claims from screenshot** sends the reviewed screenshot to Gemini. Edit the claim and click **Verify claim** to retrieve Tavily evidence and a validated Gemini verdict. Selected text and right-click verification are supported. Closing the website does not disable the installed extension. Keep the browser running and, for localhost, keep the backend running.

The extension stores up to 20 text reports locally and never stores screenshots. Reload the website after installation to connect or toggle the extension from Settings. Public one-click installation requires publishing to Chrome Web Store or Edge Add-ons; the current ZIP supports development installation. See the [extension guide](frontend/client/extension/README.md) for permissions and custom backend configuration.

The server tries `GEMINI_FALLBACK_MODEL` when the primary model is busy or unavailable, using the same evidence and citation validation; the report records the actual model. Authentication and quota failures do not trigger model switching. Optional Google search stays disabled with `GOOGLE_SEARCH_ENABLED=false`. If enabled, the key alone uses Google’s fact-check index; `GOOGLE_SEARCH_ENGINE_ID` enables general Custom Search. Both require the corresponding Google API to be enabled. A Google outage is visible in the report and does not discard Tavily evidence.

`npm run benchmark` runs 30 real-provider cases against `BENCHMARK_URL` (default http://127.0.0.1:18082). It checks expected verdicts, specific explanations and exact quotations. These are regression examples, not a general accuracy estimate.

## License

MIT.
