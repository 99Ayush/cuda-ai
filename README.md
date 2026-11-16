# CUDA AI — Crisis Coordination & Claim Verification

**A fact-checking service that grounds every verdict in live web evidence, and explains itself.**

> 🔗 **Live:** [cuda-ai.vercel.app](https://cuda-ai.vercel.app)

During an emergency — a fire alarm, a stampede scare, a public event — the fastest-spreading information is usually the least verified. A single viral rumour can move a crowd before anyone official has spoken. CUDA AI is a claim-verification backend built for that window: paste a claim, and it searches the live web, asks a model to judge it against the evidence it found, and returns a verdict with a reliability score, an explanation and citations.

---

## How a claim is verified

```
claim  →  Tavily web search (5 results, advanced depth)
       →  evidence assembled into a grounded context block
       →  Gemini 2.5 Flash, constrained to a JSON schema
       →  parse → validate → verdict + score + explanation + citations
       →  append to history
```

Three things make this more than a prompt wrapper:

**1. Evidence before opinion.** The model never sees the bare claim on its own — it sees the claim plus the search results retrieved for it. If search returns nothing, the response is labelled as training-knowledge-only rather than passed off as verified.

**2. Constrained output, then parsed.** The prompt pins an exact JSON contract — `status`, `reliability_score`, `explanation`, `citations`, `bias_rating` — and the response is stripped of markdown fences and regex-extracted before `JSON.parse`. Malformed model output is a caught error, not a silent failure.

**3. Graceful degradation.** If the Gemini call fails, the service does not return a blank screen. It falls back to a keyword-signal scorer over the retrieved context and returns a low-confidence verdict marked as such.

Scoring bands are explicit: `TRUE → 70–100`, `MIXED → 31–69`, `FAKE → 0–30`.

---

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service and key-configuration check |
| `POST` | `/analyze-claim` | Body: `{ "text": "..." }` or `{ "pageUrl": "..." }` → verdict object |
| `GET` | `/history` | Last 100 analyses (in-memory, newest first) |

**Example response**

```json
{
  "status": "FAKE",
  "reliability_score": 18,
  "explanation": "No credible source reports this; the original claim appears to be a mistranslation of an unrelated incident.",
  "citations": ["https://..."],
  "bias_rating": "Emotional",
  "latency_ms": 2140
}
```

Rate limiting is applied per IP, and the service serves the built React client from `frontend/client/dist` in production.

---

## Architecture

```
cuda-ai/
├── backend/api/index.js          Express service (routing, search, verification, fallback)
├── frontend/client/              React + Vite client
│   └── src/main.jsx              Crisis dashboard UI
├── .env.example
└── README.md
```

**Persistence:** verification history is held in memory, capped at 100 entries. Supabase (Postgres) is wired in and used when `SUPABASE_URL` and `SUPABASE_KEY` are present — moving history from process memory to durable storage is the obvious next step.

---

## Running locally

**Prerequisites:** Node.js 18+, a Gemini API key, a Tavily API key

```bash
cd backend/api
npm install
cp ../../.env.example .env      # GEMINI_API_KEY, TAVILY_API_KEY
npm start                        # http://localhost:8080
```

```bash
cd frontend/client
npm install
npm run dev                      # http://localhost:5173
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Claim analysis |
| `TAVILY_API_KEY` | Yes | Evidence retrieval |
| `SUPABASE_URL` / `SUPABASE_KEY` | No | Durable history storage |
| `PORT` | No | Defaults to 8080 |

---

## Stack

**Backend** — Node.js, Express, Axios, express-rate-limit, Supabase client
**AI** — Google Gemini 2.5 Flash (structured JSON), Tavily Search API
**Frontend** — React, Vite, Tailwind CSS, Framer Motion, Recharts

## License

MIT
