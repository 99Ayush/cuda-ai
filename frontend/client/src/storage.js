export const HISTORY_KEY = "cuda-ai-checks-v3";
const verdicts = new Set(["TRUE", "FALSE", "MIXED", "UNVERIFIED"]);
function safeUrl(value) {
  try {
    const u = new URL(value);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}
export function validResult(row) {
  return (
    !!row &&
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    row.id.length <= 100 &&
    typeof row.input === "string" &&
    row.input.length <= 2048 &&
    ["claim", "article"].includes(row.input_type) &&
    verdicts.has(row.verdict) &&
    typeof row.summary === "string" &&
    Number.isFinite(row.latency_ms) &&
    row.latency_ms >= 0 &&
    (row.warnings === undefined ||
      (Array.isArray(row.warnings) &&
        row.warnings.every((warning) => typeof warning === "string"))) &&
    Number.isFinite(Date.parse(row.checked_at)) &&
    Array.isArray(row.claims) &&
    row.claims.length > 0 &&
    row.claims.length <= 3 &&
    row.claims.every(
      (c) =>
        c &&
        typeof c.claim === "string" &&
        verdicts.has(c.verdict) &&
        typeof c.explanation === "string" &&
        typeof c.evidence_strength === "string" &&
        Array.isArray(c.sources) &&
        c.sources.length <= 6 &&
        Array.isArray(c.evidence) &&
        c.evidence.length <= 6 &&
        c.sources.every(
          (s) =>
            s &&
            typeof s.id === "string" &&
            typeof s.title === "string" &&
            typeof s.publisher === "string" &&
            typeof s.content === "string" &&
            (s.provider === undefined || typeof s.provider === "string") &&
            (s.published_at == null || typeof s.published_at === "string") &&
            safeUrl(s.url),
        ) &&
        c.evidence.every(
          (e) =>
            e &&
            typeof e.quote === "string" &&
            ["SUPPORTS", "REFUTES", "CONTEXT"].includes(e.stance) &&
            c.sources.some((s) => s.id === e.source_id),
        ),
    )
  );
}
function normalizedHistory(history) {
  const seen = new Set();
  return history.filter((row) => {
    if (!validResult(row) || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, 50);
}
function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
export function readHistory(storage = defaultStorage()) {
  try {
    const data = JSON.parse(storage?.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(data) ? normalizedHistory(data) : [];
  } catch {
    return [];
  }
}
export function saveHistory(history, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify(normalizedHistory(history)),
    );
    return true;
  } catch {
    return false;
  }
}
export function downloadJson(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
