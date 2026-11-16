const test = require("node:test");
const assert = require("node:assert/strict");
const { createEngine } = require("../../../frontend/client/server/engine.cjs");
const { config, providers } = require("./helpers.cjs");
const storageModule = import("../../../frontend/client/src/storage.js");
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
