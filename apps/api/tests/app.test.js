const test = require("node:test");
const assert = require("node:assert/strict");
const { config, server } = require("./helpers.js");
const claim = "Lightning never strikes the same place twice.";
const post = (base, body, headers = {}) =>
  fetch(base + "/api/analyze-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("readiness waits for storage initialization rather than reporting a premature success", async (t) => {
  const storeModule = require("../dist/store.js");
  let finish;
  t.mock.method(
    storeModule,
    "createStore",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const base = await server(t);
  try {
    assert.equal((await fetch(base + "/readyz")).status, 503);
  } finally {
    finish({ close: async () => {} });
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await fetch(base + "/readyz")).status, 200);
});

test("app imports without listening and exposes configured readiness", async (t) => {
  const base = await server(t);
  const response = await fetch(base + "/api/health");
  assert.equal((await response.json()).status, "ready");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-powered-by"), null);
});
test("unconfigured app reports setup required and rejects analysis", async (t) => {
  const base = await server(t, { config: { ...config, tavilyKey: "" } });
  assert.equal((await (await fetch(base + "/api/health")).json()).status, "setup_required");
  assert.equal((await post(base, { text: claim })).status, 503);
});
test("real HTTP analysis returns grounded result and private history stays empty", async (t) => {
  const base = await server(t);
  const response = await post(base, { text: claim });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verdict, "FALSE");
  assert.deepEqual(await (await fetch(base + "/api/history")).json(), []);
});
test("invalid types and malformed JSON return JSON validation errors", async (t) => {
  const base = await server(t);
  assert.equal((await post(base, { text: 42 })).status, 400);
  const response = await fetch(base + "/api/analyze-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_JSON");
});
test("oversized requests and unknown API endpoints return bounded JSON errors", async (t) => {
  const base = await server(t);
  assert.equal((await post(base, { text: "a".repeat(20000) })).status, 413);
  const response = await fetch(base + "/api/does-not-exist");
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "NOT_FOUND");
});
test("cross-origin abuse is blocked and explicitly allowed origins work", async (t) => {
  const base = await server(t, {
    config: { ...config, allowedOrigins: ["https://allowed.example"] },
  });
  assert.equal(
    (await post(base, { text: claim }, { Origin: "https://untrusted.example" })).status,
    403,
  );
  const response = await post(base, { text: claim }, { Origin: "https://allowed.example" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://allowed.example");
});
test("IP spoofing cannot bypass local rate limits", async (t) => {
  const base = await server(t, { config: { ...config, rateLimit: 1 } });
  assert.equal(
    (await post(base, { text: claim }, { "X-Forwarded-For": "198.51.100.1" })).status,
    200,
  );
  const response = await post(base, { text: claim }, { "X-Forwarded-For": "198.51.100.2" });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error, "RATE_LIMITED");
});
test("Vercel query rewrite and legacy endpoints share handlers", async (t) => {
  const base = await server(t);
  assert.equal((await (await fetch(base + "/api?route=health")).json()).status, "ready");
  assert.equal((await (await fetch(base + "/health")).json()).status, "ready");
  const response = await fetch(base + "/analyze-claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: claim }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verdict, "FALSE");
});
