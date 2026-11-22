const test = require("node:test");
const assert = require("node:assert/strict");
const { calibrate, normalizeSources } = require("../dist/sources.js");
const now = Date.parse("2026-11-22T00:00:00Z");
function finding(stances, recent = []) {
  const sources = normalizeSources(
    stances.map((_, index) => ({
      url: `https://publisher-${index + 1}.example/evidence`,
      content:
        "A controlled quotation used to exercise citation policy rather than factual accuracy.",
      published_date: recent.includes(index) ? "2026-11-21" : "2020-01-01",
    })),
    0,
    undefined,
    now,
  );
  return {
    claim: "A factual assertion about current events.",
    verdict: "TRUE",
    claim_kind: "FACTUAL",
    explanation: "Controlled policy test.",
    evidence_strength: "Multiple sources",
    confidence: 0.9,
    sources,
    evidence: sources.map((source, index) => ({
      source_id: source.id,
      quote: source.content,
      stance: stances[index],
    })),
  };
}
test("context citations cannot satisfy independent corroboration for a definitive verdict", () => {
  for (const verdict of ["TRUE", "FALSE"]) {
    const stance = verdict === "TRUE" ? "SUPPORTS" : "REFUTES";
    const row = { ...finding([stance, "CONTEXT"]), verdict };
    const result = calibrate(row, false, 2);
    assert.equal(result.verdict, "UNVERIFIED");
    assert.equal(result.confidence, null);
    assert.equal(result.evidence.length, 2, "Retain the citations for transparent review");
  }
});
test("a recent context citation cannot make stale substantive evidence current", () => {
  const row = finding(["SUPPORTS", "SUPPORTS", "CONTEXT"], [2]);
  assert.equal(calibrate(row, true, 2).verdict, "UNVERIFIED");
});
test("genuinely corroborating recent evidence still passes the policy", () => {
  const row = finding(["SUPPORTS", "SUPPORTS", "CONTEXT"], [1]);
  assert.equal(calibrate(row, true, 2).verdict, "TRUE");
  const mixed = { ...finding(["SUPPORTS", "REFUTES"]), verdict: "MIXED" };
  assert.equal(calibrate(mixed, false, 2).verdict, "MIXED");
});
test("Wikimedia and WHO sibling domains do not count as independent organizations", () => {
  for (const domains of [
    ["wikipedia.org", "wikidata.org"],
    ["who.int", "iarc.fr"],
  ]) {
    const sources = normalizeSources(
      domains.map((domain) => ({
        url: `https://${domain}/evidence`,
        content: "Controlled evidence for ownership-policy testing only.",
      })),
      0,
    );
    const row = {
      ...finding(["SUPPORTS", "SUPPORTS"]),
      sources,
      evidence: sources.map((source) => ({
        source_id: source.id,
        quote: source.content,
        stance: "SUPPORTS",
      })),
    };
    assert.equal(calibrate(row, false, 2).verdict, "UNVERIFIED");
  }
});
