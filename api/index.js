console.log('[CUDA_BOOT]: INITIALIZING_CORE_SYSTEM...');
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// --- PATH LOGGING ---
const DIST_PATH = path.join(__dirname, '../client/dist');
console.log('[CUDA_BOOT]: DIST_PATH:', DIST_PATH);
console.log('[CUDA_BOOT]: DIST_EXISTS:', require('fs').existsSync(DIST_PATH));

// --- SAFETY POLYFILL ---
if (typeof File === 'undefined') {
  console.log('[CUDA_BOOT]: APPLYING_FILE_POLYFILL');
  const { Blob } = require('node:buffer');
  global.File = class File extends Blob {
    constructor(parts, filename, options) {
      super(parts, options);
      this.name = filename;
      this.lastModified = options?.lastModified || Date.now();
    }
  };
}

// --- KEYS CHECK ---
console.log('[CUDA_BOOT]: GEMINI_KEY:', !!process.env.GEMINI_API_KEY);
console.log('[CUDA_BOOT]: TAVILY_KEY:', !!process.env.TAVILY_API_KEY);

// --- In-Memory History Store ---
const scanHistory = [];

// --- Supabase (optional) ---
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

// --- Gemini Call ---
async function callGeminiDirect(prompt) {
  const tKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!tKey) throw new Error('NO_GEMINI_KEY');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${tKey}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 25000
  });

  const raw = response.data.candidates[0].content.parts[0].text;
  console.log('[GEMINI_RAW]:', raw.substring(0, 300));
  return raw;
}

// --- Tavily Web Search ---
async function performSearch(query) {
  const tKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!tKey) return [];
  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: tKey,
      query: query,
      search_depth: "advanced",
      max_results: 5
    }, { timeout: 10000 });
    return response.data.results || [];
  } catch (err) {
    console.error('[TAVILY_ERROR]:', err.message);
    return [];
  }
}

// --- Core Analysis Engine ---
async function analyzeClaim({ text, pageUrl }) {
  const startTime = Date.now();
  const inputToVerify = (text || pageUrl || '').trim();
  if (!inputToVerify) throw new Error('EMPTY_CLAIM');

  let context = '';
  let webCitations = [];

  // Step 1: Web search for real-world context
  const searchResults = await performSearch(inputToVerify);
  for (const res of searchResults) {
    context += `[SOURCE]: ${res.title}\n[DATA]: ${res.content}\n[URL]: ${res.url}\n\n`;
    webCitations.push(res.url);
  }

  // Step 2: Ask Gemini to analyze with strict JSON output
  const prompt = `You are a professional fact-checker. Analyze this claim with precision: "${inputToVerify}"

Web research context:
${context || 'No web context available. Use your training knowledge.'}

Your task:
1. Determine if this claim is TRUE, FAKE, or MIXED based on facts.
2. A claim is FAKE if it is demonstrably false or factually incorrect (e.g., wrong political office holder, false scientific claim, incorrect historical event).
3. A claim is TRUE if it is verified and accurate.
4. A claim is MIXED if it is partially true, outdated, or lacks sufficient evidence.
5. Set reliability_score: 70-100 for TRUE, 0-30 for FAKE, 31-69 for MIXED.

Return ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "status": "TRUE" or "FAKE" or "MIXED",
  "reliability_score": <number 0-100>,
  "explanation": "<2-3 sentence factual explanation of why the claim is true or false>",
  "citations": ["<url1>", "<url2>"],
  "bias_rating": "<Neutral|Political|Emotional|Misleading>"
}`;

  try {
    const synthResponse = await callGeminiDirect(prompt);

    // Try to parse the JSON — handle markdown code blocks too
    let jsonText = synthResponse.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```(?:json)?/g, '').trim();
    }
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('NO_JSON_IN_RESPONSE');

    const result = JSON.parse(jsonMatch[0]);

    // Merge web citations into Gemini's citations if missing
    if (!result.citations || result.citations.length === 0) {
      result.citations = webCitations.slice(0, 3);
    }
    result.latency_ms = Date.now() - startTime;
    result.llm_consensus = { investigator: 'GEMINI_2.5_FLASH', synthesizer: 'CUDA_SYNTH_V2', match: true };

    // Save to in-memory history
    scanHistory.unshift({
      id: Date.now(),
      claim: inputToVerify,
      status: result.status,
      score: result.reliability_score,
      explanation: result.explanation,
      citations: result.citations,
      metadata: { latency_ms: result.latency_ms },
      timestamp: new Date().toISOString()
    });
    if (scanHistory.length > 100) scanHistory.pop();

    return result;

  } catch (geminiError) {
    // Emergency fallback — use Tavily context to make a best-guess decision
    console.error('[GEMINI_FAIL]:', geminiError.message);
    const ctxLower = context.toLowerCase();

    // Keyword-based verdict from web context
    const fakeSignals = ['not the', 'is not', 'incorrect', 'false', 'never was', 'no evidence', 'disputed', 'debunked'];
    const trueSignals = ['confirmed', 'verified', 'is true', 'according to', 'officially', 'declared'];
    const fakeScore = fakeSignals.filter(w => ctxLower.includes(w)).length;
    const trueScore = trueSignals.filter(w => ctxLower.includes(w)).length;

    let status, reliability_score;
    if (fakeScore > trueScore) {
      status = 'FAKE';
      reliability_score = 15;
    } else if (trueScore > fakeScore) {
      status = 'TRUE';
      reliability_score = 72;
    } else {
      status = 'MIXED';
      reliability_score = 45;
    }

    const fallback = {
      status,
      reliability_score,
      explanation: `[AI_FALLBACK]: Primary analysis engine unavailable. Verdict based on ${webCitations.length} web sources. Confidence limited — please re-analyze for definitive result.`,
      citations: webCitations.slice(0, 3),
      latency_ms: Date.now() - startTime,
      bias_rating: 'Neutral',
      llm_consensus: { investigator: 'TAVILY_FALLBACK', synthesizer: 'CUDA_LOCAL', match: false }
    };

    scanHistory.unshift({
      id: Date.now(),
      claim: inputToVerify,
      status: fallback.status,
      score: fallback.reliability_score,
      explanation: fallback.explanation,
      citations: fallback.citations,
      metadata: { latency_ms: fallback.latency_ms },
      timestamp: new Date().toISOString()
    });

    return fallback;
  }
}

// --- Express App Setup ---
const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(DIST_PATH));

// Rate limiter
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use('/analyze-claim', limiter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'UP', port: process.env.PORT, gemini: !!process.env.GEMINI_API_KEY, tavily: !!process.env.TAVILY_API_KEY }));

// Serve frontend root
app.get('/', (req, res) => {
  const indexPath = path.join(DIST_PATH, 'index.html');
  if (require('fs').existsSync(indexPath)) res.sendFile(indexPath);
  else res.send('<h1>CUDA AI: SYSTEM_BOOTING</h1><script>setTimeout(()=>location.reload(),5000)</script>');
});

// Analyze claim API
app.post('/analyze-claim', async (req, res) => {
  try {
    const result = await analyzeClaim(req.body);
    res.json(result);
  } catch (error) {
    console.error('[API_ERROR]:', error.message);
    res.status(500).json({ error: 'CORE_ENGINE_FAILURE', message: error.message });
  }
});

// History API — returns last 50 scans
app.get('/history', (req, res) => {
  res.json(scanHistory.slice(0, 50));
});

// SPA fallback — must be last
app.get('*', (req, res) => {
  const indexPath = path.join(DIST_PATH, 'index.html');
  if (require('fs').existsSync(indexPath)) res.sendFile(indexPath);
  else res.redirect('/');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`[CUDA_CORE]: SYSTEM_LIVE_ON_PORT_${PORT}`));
module.exports = app;
