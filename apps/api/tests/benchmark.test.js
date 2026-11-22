const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreResult } = require("../../../scripts/benchmark-score.js");
const { createEngine } = require("../dist/engine.js");
const { config, providers } = require("./helpers.js");
test("benchmark scores actual citations and distinguishes honest abstention from evidence-free verdicts", async () => {
  const result = await createEngine(
    config,
    providers(),
  )({ text: "Lightning never strikes the same place twice." });
  const item = { expected: ["FALSE"], terms: ["lightning"] };
  const grounded = scoreResult(item, result, true);
  assert.equal(grounded.passed, true);
  assert.equal(grounded.quotes_checked, 1);
  const unsupported = structuredClone(result);
  unsupported.claims[0].evidence = [];
  const empty = scoreResult(item, unsupported, true);
  assert.equal(empty.passed, false);
  assert.equal(empty.valid_quotes, false);
  assert.equal(empty.citation_status, "none");
  unsupported.verdict = unsupported.claims[0].verdict = "UNVERIFIED";
  const abstention = scoreResult({ ...item, expected: ["UNVERIFIED"] }, unsupported, true);
  assert.equal(abstention.passed, true);
  assert.equal(abstention.valid_quotes, false, "Abstaining is not a valid-citation measurement");
  const fabricated = structuredClone(result);
  fabricated.claims[0].evidence[0].quote =
    "This fabricated quotation never appeared in the supplied source.";
  assert.equal(scoreResult(item, fabricated, true).passed, false);
  assert.equal(scoreResult(item, { verdict: "FALSE" }, true).passed, false);
});
