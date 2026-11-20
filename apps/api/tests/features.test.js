const test = require("node:test");
const assert = require("node:assert/strict");
const { config, providers, server, modelOutput } = require("./helpers.js");
const { createProviders } = require("../../../apps/api/src/providers.js");
const { validateImage, createScreenExtractor } = require("../../../apps/api/src/screen.js");
const { zip, crc32 } = require("../../../scripts/build-extension.js");
const { normalizeSources, validateAnalysis } = require("../../../apps/api/src/engine.js");
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/R6sAAAAASUVORK5CYII=";
test("screenshots reject non-images, malformed and oversized data before provider calls", () => {
  for (const value of [null, {}, { image: "https://example.com/image" }, { image: "data:image/png;base64,SGVsbG8=" }, { image: "data:image/png;base64," + "A".repeat(5_600_004) }]) assert.throws(() => validateImage(value), e => e.code === "INVALID_IMAGE");
  assert.equal(validateImage({ image }).mimeType, "image/png");
});
test("vision extraction receives image separately, preserves claims, and rejects fabricated shape", async () => {
  let seen;
  const extract = createScreenExtractor(config, providers({ generate: async (...args) => { seen = args; return { text: "Earth orbits the Sun.", claims: ["Earth orbits the Sun."] }; } }));
  assert.deepEqual((await extract({ image })).claims, ["Earth orbits the Sun."]);
  assert.equal(seen[4].mimeType, "image/png");
  assert.match(seen[0], /untrusted/);
  await assert.rejects(createScreenExtractor(config, providers({ generate: async () => ({ text: "text", claims: [false] }) }))({ image }), e => e.code === "INVALID_EXTRACTION");
});
test("screen API supports deployment rewrite, bounded bodies and extension CORS without permitting websites", async t => {
  const base = await server(t, { providers: providers({ generate: async () => ({ text: "Earth orbits the Sun.", claims: ["Earth orbits the Sun."] }) }) });
  const headers = { "Content-Type": "application/json", Origin: "chrome-extension://" + "a".repeat(32) };
  const r = await fetch(base + "/api?route=extract-screen", { method: "POST", headers, body: JSON.stringify({ image }) });
  assert.equal(r.status, 200); assert.equal(r.headers.get("access-control-allow-origin"), headers.Origin);
  assert.equal((await r.json()).claims[0], "Earth orbits the Sun.");
  const blocked = await fetch(base + "/api/extract-screen", { method: "POST", headers: { ...headers, Origin: "https://untrusted.example" }, body: JSON.stringify({ image }) });
  assert.equal(blocked.status, 403);
  const bad = await fetch(base + "/api/extract-screen", { method: "POST", headers, body: JSON.stringify({ image: "bad" }) }); assert.equal(bad.status, 400);
});
test("busy Gemini uses a fallback with identical evidence, while quota never switches models", async () => {
  const calls = [];
  const provider = createProviders({ ...config, fallbackModel: "fallback-model" }, async (url, options) => {
    calls.push({ url, body: options.body });
    if (url.includes(config.model)) return new Response("busy", { status: 503 });
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(modelOutput()) }] } }] });
  });
  const result = await provider.generate("Check", { evidence: "identical" }, { type: "OBJECT" }, AbortSignal.timeout(5000));
  assert.equal(result._model, "fallback-model"); assert.equal(calls.length, 3); assert.equal(calls[0].body, calls[2].body);
  let quotas = 0;
  const limited = createProviders({ ...config, fallbackModel: "fallback" }, async () => { quotas++; return new Response("limited", { status: 429 }); });
  await assert.rejects(limited.generate("Check", {}, { type: "OBJECT" }, AbortSignal.timeout(1000)), e => e.code === "PROVIDER_QUOTA"); assert.equal(quotas, 1);
});
test("Google search merges sources and reports failure without discarding Tavily evidence", async () => {
  for (const failed of [false, true]) {
    const provider = createProviders({ ...config, googleKey: "test-google", googleEngineId: "engine" }, async url => {
      if (url.includes("tavily")) return Response.json({ results: [{ url: "https://source.example/story", content: "Independent evidence text for the claim." }] });
      assert.match(url, /cx=engine/);
      if (failed) return new Response("denied", { status: 403 });
      return Response.json({ items: [{ link: "https://google-source.example/story", title: "Evidence", snippet: "Google returned a corroborating source excerpt." }] });
    });
    const results = await provider.search("Claim to check", [], AbortSignal.timeout(1000));
    assert.equal(results[0].provider, "Tavily");
    assert.equal(results.warnings.length, failed ? 1 : 0);
    if (!failed) assert.equal(results[1].provider, "Google Search");
  }
});
test("extension archive has verified CRC, directory and expected filenames", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const data = zip([["manifest.json", Buffer.from('{"manifest_version":3}')]]);
  assert.equal(data.readUInt32LE(0), 0x04034b50);
  assert.equal(data.readUInt32LE(data.length - 22), 0x06054b50);
  assert.equal(data.readUInt16LE(data.length - 14), 1);
  assert.equal(data.readUInt32LE(data.length - 6), 30 + "manifest.json".length + 22);
});
test("excerpt citations insert verbatim source text and reject invented excerpt IDs", () => {
  const claim = "The Sun is a planet.";
  const groups = [normalizeSources([{ url: "https://source.example/science", content: "The Sun is a star, not a planet. Earth orbits the Sun." }], 0)];
  const valid = modelOutput({ evidence: [{ source_id: "1-1", excerpt_id: "1-1:e1", stance: "REFUTES" }] });
  const rows = validateAnalysis(valid, [claim], groups);
  assert.equal(rows[0].verdict, "FALSE"); assert.equal(rows[0].evidence[0].quote, "The Sun is a star, not a planet.");
  valid.claims[0].evidence[0].excerpt_id = "e1";
  assert.equal(validateAnalysis(valid, [claim], groups)[0].evidence[0].quote, "The Sun is a star, not a planet.");
  valid.claims[0].evidence[0].excerpt_id = "invented";
  assert.equal(validateAnalysis(valid, [claim], groups)[0].verdict, "UNVERIFIED");
});
test("opinions and unresolved predictions cannot become definitive verdicts", () => {
  const claim = "NASA will announce confirmed alien life tomorrow.";
  const groups = [normalizeSources([{ url: "https://source.example/past", content: "NASA denied a different alien announcement in 2017." }], 0)];
  for (const claim_kind of ["PREDICTION", "OPINION"]) {
    const output = modelOutput({ claim_kind, evidence: [{ source_id: "1-1", excerpt_id: "1-1:e1", stance: "REFUTES" }] });
    assert.equal(validateAnalysis(output, [claim], groups)[0].verdict, "UNVERIFIED");
  }
});
