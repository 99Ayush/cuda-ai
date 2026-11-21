const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const {
  createEngine,
  validateAnalysis,
  generateQueries,
  normalizeSources,
} = require("../dist/engine.js");
const { matchQuote } = require("../dist/quotes.js");
const { publicAddress, publicUrl, resolvePublic } = require("../dist/url.js");
const { calibrate } = require("../dist/sources.js");
const { TtlCache } = require("../dist/cache.js");
const { JobQueue, TokenBucket } = require("../dist/queue.js");
const { validResult } = require("@claimlens/shared");
const config = { geminiKey: "fixture", tavilyKey: "fixture", model: "fixture", minimumSources: 2 };
const claim = "Lightning never strikes the same place twice.";
const sources = [
  {
    url: "https://www.weather.gov/facts",
    title: "Weather facts",
    content: "Lightning often strikes the same place repeatedly.",
    published_date: new Date().toISOString(),
  },
  {
    url: "https://www.bom.gov.au/facts",
    title: "Australian weather facts",
    content: "Lightning may strike the same place many times.",
    published_date: new Date().toISOString(),
  },
];
function output() {
  return {
    claims: [
      {
        claim_index: 0,
        claim_kind: "FACTUAL",
        verdict: "FALSE",
        confidence: 0.9,
        explanation: "Both cited weather agencies describe repeated lightning strikes.",
        evidence: [
          { source_id: "1-1", excerpt_id: "1-1:e1", stance: "REFUTES" },
          { source_id: "1-2", excerpt_id: "1-2:e1", stance: "REFUTES" },
        ],
      },
    ],
  };
}
test("strict model output rejects absent and unknown classification", () => {
  for (const kind of [undefined, "INVENTED"]) {
    const row = output();
    row.claims[0].claim_kind = kind;
    assert.throws(
      () => validateAnalysis(row, [claim], [normalizeSources(sources, 0)]),
      (error) => error.code === "INVALID_ANALYSIS",
    );
  }
});
test("pipeline preserves an empty unverified article across the browser contract", async () => {
  const engine = createEngine(config, {
    extract: async () => "An article without factual claims.",
    search: async () => [],
    generate: async () => ({ claims: [] }),
  });
  const result = await engine({ pageUrl: "https://example.org/story" });
  assert.equal(result.verdict, "UNVERIFIED");
  assert.equal(validResult(result), true);
});
test("diverse queries include counter-evidence and keep universal qualifiers", () => {
  const queries = generateQueries(claim);
  assert.equal(queries.length, 3);
  assert.match(queries[2], /counterexample/);
  for (const query of queries) assert.match(query, /never/);
});
test("canonical URLs deduplicate tracking and group affiliated owners", () => {
  const rows = normalizeSources(
    [
      { ...sources[0], url: "https://weather.gov/facts?utm_source=a" },
      { ...sources[0], url: "https://weather.gov/facts?utm_source=b" },
    ],
    0,
  );
  assert.equal(rows.length, 1);
  const related = normalizeSources(
    [sources[0], { ...sources[1], url: "https://noaa.gov/facts" }],
    0,
  );
  const finding = validateAnalysis(output(), [claim], [related])[0];
  assert.equal(calibrate(finding, false, 2).verdict, "UNVERIFIED");
});
test("real staged pipeline validates independent excerpts and abstains on stale current claims", async () => {
  const engine = createEngine(config, {
    search: async () => sources,
    extract: async () => "",
    generate: async () => output(),
  });
  const result = await engine({ text: claim });
  assert.equal(result.verdict, "FALSE");
  assert.equal(result.claims[0].validation.accepted, 2);
  const finding = result.claims[0];
  finding.sources.forEach((source) => (source.quality.recent = false));
  assert.equal(calibrate(finding, true, 2).verdict, "UNVERIFIED");
});
test("normalized quotes are accepted but changed negation and numbers cannot pass fuzzy matching", () => {
  assert.equal(matchQuote("The number is 206 bones.", "The number is 207 bones.").valid, false);
  assert.equal(matchQuote("The medicine does not work.", "The medicine does work.").valid, false);
  fc.assert(
    fc.property(
      fc
        .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{30,100}$/)
        .filter((value) => value.replace(/\s/g, "").length >= 15),
      (value) => {
        assert.equal(matchQuote(value + " More context.", value).valid, true);
      },
    ),
    { seed: 42, numRuns: 200 },
  );
});
test("private and mapped address families are blocked and DNS answers are all checked", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
  await assert.rejects(
    resolvePublic(new URL("https://example.org"), async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    (error) => error.code === "UNSAFE_URL",
  );
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 255 }), (value) =>
      assert.equal(publicUrl(`http://127.0.0.${value}`), null),
    ),
    { seed: 42, numRuns: 200 },
  );
});
test("cache expiration and capacity are bounded", () => {
  let now = 0;
  const cache = new TtlCache(1, 10, () => now);
  cache.set("a", { value: 1 });
  cache.set("b", { value: 2 });
  assert.equal(cache.get("a"), undefined);
  now = 11;
  assert.equal(cache.get("b"), undefined);
});
test("queued cancellation removes the waiter and running jobs release their slot", async () => {
  const queue = new JobQueue(1, 1);
  const running = new AbortController();
  let release;
  const first = queue.run(() => new Promise((resolve) => (release = resolve)), running.signal);
  await new Promise((resolve) => setImmediate(resolve));
  const queued = new AbortController();
  const second = queue.run(async () => 2, queued.signal);
  const rejection = assert.rejects(second, (error) => error.name === "AbortError");
  queued.abort();
  await rejection;
  assert.equal(queue.state.queued, 0);
  release(1);
  assert.equal(await first, 1);
  assert.equal(queue.state.active, 0);
});
test("token bucket refills without trusting arbitrary new API-key buckets", () => {
  let now = 0;
  const limiter = new TokenBucket(1, 1000, () => now);
  assert.equal(limiter.take("ip").allowed, true);
  assert.equal(limiter.take("ip").allowed, false);
  now = 1000;
  assert.equal(limiter.take("ip").allowed, true);
});
