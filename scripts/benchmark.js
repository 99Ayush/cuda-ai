const fs = require("node:fs");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const cases = require("./benchmark-cases.json");
const { scoreResult } = require("./benchmark-score.js");
const base = process.env.BENCHMARK_URL || "http://127.0.0.1:8080";
const output =
  process.env.BENCHMARK_OUTPUT || path.resolve(__dirname, "../work/benchmark-results.json");
const report = { started_at: new Date().toISOString(), base, health: null, cases: [] };
async function run() {
  report.health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) }).then(
    (r) => r.json(),
  );
  console.log(JSON.stringify({ health: report.health, base }));
  if (report.health.test_mode)
    throw new Error("Refusing to benchmark simulated provider responses.");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  for (const item of cases) {
    const started = Date.now();
    let row;
    try {
      let response, result;
      // Respect the server's ten-check limit without changing production limits.
      for (let attempt = 0; attempt < 4; attempt++) {
        response = await fetch(`${base}/api/analyze-claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.input }),
          signal: AbortSignal.timeout(115000),
        });
        result = await response.json();
        if (response.status !== 429 || result.code !== "RATE_LIMITED" || attempt === 3) break;
        console.log(JSON.stringify({ waiting_for_rate_limit: item.id }));
        const seconds = Math.min(60, Math.max(1, Number(response.headers.get("retry-after")) || 6));
        await delay(seconds * 1000);
      }
      row = {
        ...item,
        http_status: response.status,
        success: response.ok,
        ...scoreResult(item, result, response.ok),
        elapsed_ms: Date.now() - started,
        result,
      };
    } catch (error) {
      row = { ...item, passed: false, error: error.name, elapsed_ms: Date.now() - started };
    }
    report.cases.push(row);
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        id: row.id,
        input: row.input,
        verdict: row.result?.verdict,
        expected: row.expected,
        passed: row.passed,
        specific: row.specific,
        summary: row.result?.summary,
        error: row.result?.error || row.error,
      }),
    );
  }
  report.finished_at = new Date().toISOString();
  report.passed = report.cases.filter((row) => row.passed).length;
  report.total = report.cases.length;
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, total: report.total, output }));
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
