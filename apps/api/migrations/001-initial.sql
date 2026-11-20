CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checks (id TEXT PRIMARY KEY, input_hash TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources (check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE, source_id TEXT NOT NULL, url TEXT NOT NULL, content TEXT NOT NULL, PRIMARY KEY(check_id,source_id));
CREATE TABLE IF NOT EXISTS evidence (check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE, claim_index INTEGER NOT NULL, position INTEGER NOT NULL, source_id TEXT NOT NULL, stance TEXT NOT NULL, quote TEXT NOT NULL, PRIMARY KEY(check_id,claim_index,position));
CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cache (cache_key TEXT PRIMARY KEY, result_json TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS checks_expiry ON checks(expires_at);
CREATE INDEX IF NOT EXISTS shares_expiry ON shares(expires_at);
