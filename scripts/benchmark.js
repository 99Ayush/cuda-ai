const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const cases = require("./benchmark-cases.json");
const base = process.env.BENCHMARK_URL || "http://127.0.0.1:18082";
const output = process.env.BENCHMARK_OUTPUT || path.resolve(__dirname, "../../../outputs/cuda-ai-30-cases.json");
const report = { started_at: new Date().toISOString(), base, health: null, cases: [] };
async function run() {
  report.health = await fetch(`${base}/api/health`).then(r => r.json());
  console.log(JSON.stringify({ health: report.health, base }));
  if (report.health.test_mode) throw new Error("Refusing to benchmark simulated provider responses.");
  for (const item of cases) {
    const started = Date.now();
    let row;
    try {
      let response;
      // Respect the server's ten-check limit without changing production limits.
      for (;;) {
        response = await fetch(`${base}/api/analyze-claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: item.input }), signal: AbortSignal.timeout(115000) });
        if (response.status !== 429) break;
        console.log(JSON.stringify({ waiting_for_rate_limit: item.id }));
        await delay(61000);
      }
      const result = await response.json();
      const explanation = (result.summary || "").toLowerCase();
      const validQuotes = result.claims?.every(claim => claim.evidence.every(e => {
        const source = claim.sources.find(s => s.id === e.source_id);
        const normalize = value => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
        return source && normalize(source.content).includes(normalize(e.quote));
      })) || false;
      const specific = item.terms.some(term => explanation.includes(term));
      const verdictMatches = item.expected.includes(result.verdict);
      row = { ...item, http_status: response.status, success: response.ok, verdict_matches: verdictMatches, specific, valid_quotes: validQuotes, passed: response.ok && verdictMatches && specific && validQuotes, elapsed_ms: Date.now() - started, result };
    } catch (error) { row = { ...item, passed: false, error: error.name, elapsed_ms: Date.now() - started }; }
    report.cases.push(row);
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ id: row.id, input: row.input, verdict: row.result?.verdict, expected: row.expected, passed: row.passed, specific: row.specific, summary: row.result?.summary, error: row.result?.error || row.error }));
  }
  report.finished_at = new Date().toISOString();
  report.passed = report.cases.filter(row => row.passed).length;
  report.total = report.cases.length;
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, total: report.total, output }));
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
