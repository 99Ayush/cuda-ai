const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { pathToFileURL } = require("node:url");
// The typed browser client is transpiled here so the test exercises the shipped
// module rather than a hand-maintained JavaScript copy.
const resolve = (specifier) =>
  JSON.stringify(
    pathToFileURL(require.resolve(specifier, { paths: [path.resolve(__dirname, "../../web")] }))
      .href,
  );
const source = ts.transpileModule(
  fs
    .readFileSync(path.resolve(__dirname, "../../../apps/web/src/api.ts"), "utf8")
    .replace("import.meta.env", "{}")
    .replace('"zod"', resolve("zod"))
    .replace('"@claimlens/shared"', resolve("@claimlens/shared")),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const client = import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("client preserves successful JSON and safe provider error messages", async (t) => {
  const { apiRequest } = await client;
  t.mock.method(globalThis, "fetch", async () => Response.json({ id: "check-1" }));
  assert.deepEqual(await apiRequest("analyze-claim"), { id: "check-1" });
  globalThis.fetch.mock.mockImplementation(async () =>
    Response.json({ message: "Provider quota reached." }, { status: 429 }),
  );
  await assert.rejects(apiRequest("analyze-claim"), /Provider quota reached/);
});

test("client handles malformed JSON and null error bodies without raw parser errors", async (t) => {
  const { apiRequest } = await client;
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{broken", { headers: { "Content-Type": "application/json" } }),
  );
  await assert.rejects(apiRequest("analyze-claim"), /unreadable response/);
  globalThis.fetch.mock.mockImplementation(async () => Response.json(null, { status: 503 }));
  await assert.rejects(apiRequest("analyze-claim"), /The check could not be completed/);
  globalThis.fetch.mock.mockImplementation(
    async () => new Response("upstream unavailable", { status: 503 }),
  );
  await assert.rejects(apiRequest("analyze-claim"), /service is unavailable/);
});

test("client distinguishes cancellation and timeout while reading the response body", async (t) => {
  const { apiRequest } = await client;
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      controller.abort();
      throw new DOMException("The operation was aborted", "AbortError");
    },
  }));
  await assert.rejects(
    apiRequest("analyze-claim", { signal: controller.signal }),
    /Check cancelled/,
  );
  globalThis.fetch.mock.mockImplementation(async () => ({
    ok: true,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      throw new DOMException("Deadline exceeded", "TimeoutError");
    },
  }));
  await assert.rejects(apiRequest("analyze-claim"), /took too long/);
});
