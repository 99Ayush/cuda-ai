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
    .replace('"@verity/shared"', resolve("@verity/shared")),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const client = import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
async function streamedResult() {
  const { createEngine } = require("../dist/engine.js");
  const { config, providers } = require("./helpers.js");
  return createEngine(
    config,
    providers(),
  )({ text: "Lightning never strikes the same place twice." });
}

test("progress streams accept CRLF frames fragmented across byte boundaries", async (t) => {
  const { streamCheck } = await client;
  const result = await streamedResult();
  const event =
    'event: stage\r\ndata: {"stage":"searching","detail":"Finding evidence","elapsed_ms":1}\r\n\r\n';
  const bytes = new TextEncoder().encode(
    event + `event: result\r\ndata: ${JSON.stringify(result)}\r\n\r\n`,
  );
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  );
  const progress = [];
  const received = await streamCheck(
    { text: result.input },
    (value) => progress.push(value),
    new AbortController().signal,
  );
  assert.equal(received.id, result.id);
  assert.equal(progress[0].stage, "searching");
});

test("a complete result resolves immediately and closes a stream left open by a proxy", async (t) => {
  const { streamCheck } = await client;
  const result = await streamedResult();
  let producer,
    cancelled = false;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            producer = controller;
            controller.enqueue(
              new TextEncoder().encode(`event: result\ndata: ${JSON.stringify(result)}\n\n`),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  );
  const operation = streamCheck({ text: result.input }, () => {}, new AbortController().signal);
  let timer;
  const received = await Promise.race([
    operation,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), 250);
    }),
  ]);
  clearTimeout(timer);
  if (!cancelled) producer.close();
  await operation;
  assert.equal(received?.id, result.id, "Do not wait for EOF after receiving the final result");
  assert.equal(cancelled, true);
});

test("malformed progress is actionable and cancels the network body", async (t) => {
  const { streamCheck } = await client;
  let cancelled = false,
    producer;
  t.after(() => {
    if (!cancelled) producer.close();
  });
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            producer = controller;
            controller.enqueue(new TextEncoder().encode("event: stage\ndata: {broken\n\n"));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  );
  await assert.rejects(
    streamCheck({ text: "A claim for verification." }, () => {}, new AbortController().signal),
    /unreadable progress/i,
  );
  assert.equal(cancelled, true);
});

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
