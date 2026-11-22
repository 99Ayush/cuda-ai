const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const { createStore } = require("../dist/store.js");
const { createEngine } = require("../dist/engine.js");
const { config, providers } = require("./helpers.js");

test("Postgres sharing uses one pooled connection and rolls back before releasing it", async (t) => {
  const { Pool } = require("pg");
  const calls = [];
  let fail = true;
  t.mock.method(Pool.prototype, "query", async () => ({ rows: [] }));
  t.mock.method(Pool.prototype, "end", async () => {});
  t.mock.method(Pool.prototype, "connect", async () => ({
    query: async (sql) => {
      calls.push(sql);
      if (fail && sql.startsWith("INSERT INTO sources"))
        throw new Error("Controlled insert failure");
      return { rows: sql.startsWith("SELECT COUNT") ? [{ count: 0 }] : [] };
    },
    release: (discard) => calls.push(discard ? "discard" : "release"),
  }));
  const store = await createStore({
    persistenceEnabled: true,
    databaseUrl: "postgresql://example.invalid/test",
    databasePath: "",
  });
  try {
    const result = await createEngine(
      config,
      providers(),
    )({ text: "Lightning never strikes the same place twice." });
    await assert.rejects(store.save(result), /Controlled insert failure/);
    assert.equal(calls[0], "BEGIN");
    assert.match(calls[1], /pg_advisory_xact_lock/);
    assert.deepEqual(calls.slice(-2), ["ROLLBACK", "release"]);
    assert.equal(calls.includes("COMMIT"), false);
    calls.length = 0;
    fail = false;
    await store.save(result);
    assert.deepEqual(calls.slice(-2), ["COMMIT", "release"]);
  } finally {
    await store.close();
  }
});

test("failed sharing writes roll back completely and the store accepts subsequent concurrent saves", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "verity-store-audit-"));
  const file = path.join(folder, "database.sqlite");
  let store, database;
  try {
    store = await createStore({ persistenceEnabled: true, databaseUrl: "", databasePath: file });
    database = new DatabaseSync(file);
    const result = await createEngine(
      config,
      providers(),
    )({ text: "Lightning never strikes the same place twice." });
    database.exec(
      "CREATE TRIGGER reject_source BEFORE INSERT ON sources BEGIN SELECT RAISE(ABORT, 'Controlled source insert failure'); END;",
    );
    await assert.rejects(store.save(result), /Controlled source insert failure/);
    for (const table of ["checks", "sources", "evidence", "shares"])
      assert.equal(
        database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
        0,
        `${table} must not retain a partial write`,
      );
    database.exec("DROP TRIGGER reject_source");
    const reports = [
      { ...result, id: randomUUID() },
      { ...result, id: randomUUID() },
    ];
    const tokens = await Promise.all(reports.map((report) => store.save(report)));
    for (let index = 0; index < tokens.length; index++)
      assert.equal((await store.read(tokens[index])).id, reports[index].id);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM checks").get().count, 2);
  } finally {
    database?.close();
    await store?.close();
    for (const suffix of ["", "-wal", "-shm"])
      if (fs.existsSync(file + suffix)) fs.unlinkSync(file + suffix);
    fs.rmdirSync(folder);
  }
});
