import { validResult, ResultSchema, type Result } from "@verity/shared";
export { validResult };
export const HISTORY_KEY = "verity-checks-v1";
const LEGACY_HISTORY_KEYS = ["claimlens-checks-v1"];
type BrowserStorage = Pick<Storage, "getItem" | "setItem">;
function defaultStorage(): BrowserStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function normalized(values: unknown[]): Result[] {
  const seen = new Set<string>();
  return values
    .filter((value): value is Result => {
      if (!validResult(value) || seen.has(value.id)) return false;
      seen.add(value.id);
      return true;
    })
    .slice(0, 50);
}
export function readHistory(storage: BrowserStorage | null = defaultStorage()): Result[] {
  try {
    const data: unknown = JSON.parse(
      storage?.getItem(HISTORY_KEY) ??
        LEGACY_HISTORY_KEYS.map((key) => storage?.getItem(key)).find(Boolean) ??
        "[]",
    );
    return Array.isArray(data) ? normalized(data) : [];
  } catch {
    return [];
  }
}
export function saveHistory(
  history: Result[],
  storage: BrowserStorage | null = defaultStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(HISTORY_KEY, JSON.stringify(normalized(history)));
    return true;
  } catch {
    return false;
  }
}
function download(data: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadJson(data: unknown, name: string): void {
  download(JSON.stringify(data, null, 2), name, "application/json");
}
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function downloadCsv(history: Result[]): void {
  const header = ["id", "input", "verdict", "summary", "checked_at", "latency_ms", "report_json"];
  const rows = history.map((row) => [
    row.id,
    row.input,
    row.verdict,
    row.summary,
    row.checked_at,
    String(row.latency_ms),
    JSON.stringify(row),
  ]);
  download(
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n"),
    "verity-history.csv",
    "text/csv;charset=utf-8",
  );
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [],
    row: string[] = [];
  let cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push([...row]);
      row.length = 0;
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("The CSV has an incomplete quoted field.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function importHistory(text: string, format: "json" | "csv"): Result[] {
  if (text.length > 2_000_000) throw new Error("Import a file smaller than 2 MB.");
  let values: unknown;
  if (format === "json") values = JSON.parse(text);
  else {
    const rows = parseCsv(text);
    const index = rows[0]?.indexOf("report_json") ?? -1;
    if (index < 0) throw new Error("Import a Verity CSV export containing full reports.");
    values = rows
      .slice(1)
      .filter((row) => row.some(Boolean))
      .map((row) => JSON.parse(row[index] || ""));
  }
  if (!Array.isArray(values) || values.length > 50) throw new Error("Import at most 50 findings.");
  for (const value of values)
    if (!ResultSchema.safeParse(value).success)
      throw new Error("The import contains an invalid or unsafe report.");
  return normalized(values);
}
