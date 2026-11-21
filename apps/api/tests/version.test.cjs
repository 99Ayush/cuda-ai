const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { createApp } = require("../dist/app.js");

const root = path.resolve(__dirname, "../../..");
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;

test("health and OpenAPI report the packaged version", async (t) => {
  const app = createApp({ testMode: true });
  const listener = app.listen(0, "127.0.0.1");
  await once(listener, "listening");
  t.after(async () => {
    listener.closeAllConnections();
    await app.locals.shutdown();
    await new Promise((resolve) => listener.close(resolve));
  });
  const base = `http://127.0.0.1:${listener.address().port}`;

  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.version, packageVersion);

  const spec = await (await fetch(base + "/api/v1/openapi.json")).json();
  assert.equal(spec.info.version, packageVersion);
});
