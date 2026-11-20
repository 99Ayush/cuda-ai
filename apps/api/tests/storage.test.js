const test = require("node:test");
const assert = require("node:assert/strict");
const { createEngine } = require("../../../apps/api/src/engine.js");
const { config, providers } = require("./helpers.js");
// Browser modules are bundled by Vite independently of Node's package type.
const storageSource = require("node:fs").readFileSync(
  require("node:path").resolve(__dirname, "../../../apps/web/src/storage.js"),
  "utf8",
).replace('"@claimlens/shared"', JSON.stringify(require("node:url").pathToFileURL(require.resolve("@claimlens/shared")).href));
const storageModule = import(
  `data:text/javascript;base64,${Buffer.from(storageSource).toString("base64")}`
);
function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
  };
}
test("browser history round trips, is bounded and survives a reload", async () => {
  const { saveHistory, readHistory } = await storageModule;
  const result = await createEngine(
    config,
    providers(),
  )({ text: "Lightning never strikes the same place twice." });
  const storage = memoryStore();
  assert.equal(
    saveHistory(
      Array.from({ length: 60 }, (_, i) => ({ ...result, id: `check-${i}` })),
      storage,
    ),
    true,
  );
  const reloaded = readHistory(storage);
  assert.equal(reloaded.length, 50);
  assert.equal(reloaded[0].claims[0].verdict, "FALSE");
});
test("corrupted, unsafe and unavailable browser storage is handled", async () => {
  const { readHistory, saveHistory, HISTORY_KEY, validResult } =
    await storageModule;
  const result = await createEngine(
    config,
    providers(),
  )({ text: "Lightning never strikes the same place twice." });
  const storage = memoryStore();
  storage.setItem(HISTORY_KEY, "{broken");
  assert.deepEqual(readHistory(storage), []);
  storage.setItem(HISTORY_KEY, JSON.stringify([{ ...result, verdict: null }]));
  assert.deepEqual(readHistory(storage), []);
  const unsafe = structuredClone(result);
  unsafe.claims[0].sources[0].url = "javascript:alert(1)";
  assert.equal(validResult(unsafe), false);
  assert.equal(
    saveHistory([result], {
      setItem() {
        throw new Error("Quota exceeded");
      },
    }),
    false,
  );
  assert.deepEqual(readHistory(null), []);
});

test("history rejects metadata that crashes rendering or produces invalid timing", async () => {
  const { validResult, readHistory, HISTORY_KEY } = await storageModule;
  const result = await createEngine(config, providers())({ text: "Lightning never strikes the same place twice." });
  const badRows = [
    { ...result, latency_ms: undefined },
    { ...result, latency_ms: -1 },
    { ...result, warnings: "not an array" },
    { ...result, warnings: [{ message: "not renderable" }] },
    { ...result, id: "" },
    { ...result, claims: [] },
  ];
  const invalidProvider = structuredClone(result);
  invalidProvider.claims[0].sources[0].provider = { name: "Tavily" };
  badRows.push(invalidProvider);
  for (const row of badRows) assert.equal(validResult(row), false);
  const storage = memoryStore();
  storage.setItem(HISTORY_KEY, JSON.stringify([...badRows, result]));
  assert.equal(readHistory(storage).length, 1);
  assert.equal(readHistory(storage)[0].id, result.id);
});

test("duplicate history IDs are removed before display and persistence", async () => {
  const { readHistory, saveHistory, HISTORY_KEY } = await storageModule;
  const result = await createEngine(config, providers())({ text: "Lightning never strikes the same place twice." });
  const storage = memoryStore();
  storage.setItem(HISTORY_KEY, JSON.stringify([result, result, { ...result, id: "second" }]));
  assert.deepEqual(readHistory(storage).map(row => row.id), [result.id, "second"]);
  assert.equal(saveHistory([result, result], storage), true);
  assert.equal(JSON.parse(storage.getItem(HISTORY_KEY)).length, 1);
});
