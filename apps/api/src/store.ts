import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { ResultSchema, type Result } from "@claimlens/shared";
import { ServiceError } from "./errors";
import type { Config } from "./config";
export interface Store {
  save(result: Result): Promise<string>;
  read(token: string): Promise<Result | null>;
  delete(token: string): Promise<void>;
  close(): Promise<void>;
}
interface Sql {
  query(sql: string, values?: unknown[]): Promise<Record<string, unknown>[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}
const migrations = fs.readFileSync(
  path.resolve(__dirname, "../migrations/001-initial.sql"),
  "utf8",
);
class SQLite implements Sql {
  private db: DatabaseSync;
  constructor(file: string) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  }
  async query(sql: string, values: unknown[] = []) {
    const statement = this.db.prepare(sql);
    const args = values as (string | number | null)[];
    if (/^\s*(SELECT|DELETE.*RETURNING)/i.test(sql))
      return statement.all(...args) as Record<string, unknown>[];
    statement.run(...args);
    return [];
  }
  async exec(sql: string) {
    this.db.exec(sql);
  }
  async close() {
    this.db.close();
  }
}
class Postgres implements Sql {
  private pool: Pool;
  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 4 });
  }
  async query(sql: string, values: unknown[] = []) {
    let index = 0;
    const converted = sql.replace(/\?/g, () => `$${++index}`);
    const result = await this.pool.query(converted, values);
    return result.rows as Record<string, unknown>[];
  }
  async exec(sql: string) {
    await this.pool.query(sql);
  }
  async close() {
    await this.pool.end();
  }
}
class DisabledStore implements Store {
  async save(_result: Result): Promise<string> {
    throw new ServiceError(
      403,
      "PERSISTENCE_DISABLED",
      "Sharing is unavailable on this server. Download the report instead.",
    );
  }
  async read(_token: string): Promise<null> {
    return null;
  }
  async delete(_token: string): Promise<void> {}
  async close(): Promise<void> {}
}
export async function createStore(
  config: Pick<Config, "persistenceEnabled" | "databaseUrl" | "databasePath">,
): Promise<Store> {
  if (!config.persistenceEnabled) return new DisabledStore();
  const db: Sql = config.databaseUrl
    ? new Postgres(config.databaseUrl)
    : new SQLite(config.databasePath);
  await db.exec(migrations);
  await db.query(
    "INSERT INTO schema_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING",
    [1, new Date().toISOString()],
  );
  return {
    async save(result) {
      const validated = ResultSchema.parse(result),
        now = new Date().toISOString(),
        expiry = new Date(Date.now() + 7 * 86400000).toISOString();
      await db.query("DELETE FROM checks WHERE expires_at < ?", [now]);
      const count = await db.query("SELECT COUNT(*) AS count FROM checks");
      if (Number(count[0]?.count) >= 1000)
        throw new ServiceError(
          503,
          "STORAGE_LIMIT",
          "Sharing capacity is full. Download the report instead.",
        );
      const hash = createHash("sha256").update(validated.input).digest("hex"),
        token = randomBytes(24).toString("base64url");
      await db.query(
        "INSERT INTO checks(id,input_hash,result_json,created_at,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET result_json=excluded.result_json,expires_at=excluded.expires_at",
        [validated.id, hash, JSON.stringify(validated), now, expiry],
      );
      for (const source of [
        ...new Map(
          validated.claims.flatMap((claim) => claim.sources).map((source) => [source.id, source]),
        ).values(),
      ])
        await db.query(
          "INSERT INTO sources(check_id,source_id,url,content) VALUES (?,?,?,?) ON CONFLICT(check_id,source_id) DO NOTHING",
          [validated.id, source.id, source.url, source.content],
        );
      for (const [index, claim] of validated.claims.entries())
        for (const [position, evidence] of claim.evidence.entries())
          await db.query(
            "INSERT INTO evidence(check_id,claim_index,position,source_id,stance,quote) VALUES (?,?,?,?,?,?) ON CONFLICT(check_id,claim_index,position) DO NOTHING",
            [validated.id, index, position, evidence.source_id, evidence.stance, evidence.quote],
          );
      await db.query("INSERT INTO shares(token,check_id,expires_at) VALUES (?,?,?)", [
        token,
        validated.id,
        expiry,
      ]);
      return token;
    },
    async read(token) {
      const rows = await db.query(
        "SELECT checks.result_json FROM shares JOIN checks ON shares.check_id=checks.id WHERE shares.token=? AND shares.expires_at>=?",
        [token, new Date().toISOString()],
      );
      const raw = rows[0]?.result_json;
      if (typeof raw !== "string") return null;
      let decoded: unknown;
      try {
        decoded = JSON.parse(raw);
      } catch {
        return null;
      }
      const parsed = ResultSchema.safeParse(decoded);
      return parsed.success ? parsed.data : null;
    },
    async delete(token) {
      await db.query("DELETE FROM shares WHERE token=?", [token]);
    },
    close: () => db.close(),
  };
}
