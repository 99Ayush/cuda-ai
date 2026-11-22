import { useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Download, Search, Trash2, X, Link2 } from "lucide-react";
import type { Result, Verdict } from "@verity/shared";
import { labels, type DashboardProps } from "../types";
import { EmptyArtwork, VerdictBadge } from "./ui";
import { t } from "../messages";
import { downloadJson, downloadCsv } from "../storage";
type HistorySort = "newest" | "oldest" | "sources";
type Props = Pick<
  DashboardProps,
  | "history"
  | "filtered"
  | "filter"
  | "setFilter"
  | "verdictFilter"
  | "setVerdictFilter"
  | "notice"
  | "onImport"
  | "persist"
  | "result"
  | "setResult"
  | "openResult"
> & { onStart: () => void };
function sourceCount(result: Result) {
  return (
    result.source_count ??
    new Set(result.claims.flatMap((claim) => claim.sources.map((source) => source.url))).size
  );
}
export default function HistoryView({
  history,
  filtered,
  filter,
  setFilter,
  verdictFilter,
  setVerdictFilter,
  notice,
  onImport,
  persist,
  result,
  setResult,
  openResult,
  onStart,
}: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<HistorySort>("newest");
  const rows = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort === "oldest"
          ? Date.parse(a.checked_at) - Date.parse(b.checked_at)
          : sort === "sources"
            ? sourceCount(b) - sourceCount(a) || Date.parse(b.checked_at) - Date.parse(a.checked_at)
            : Date.parse(b.checked_at) - Date.parse(a.checked_at),
      ),
    [filtered, sort],
  );
  return (
    <section className="archive-view">
      <div className="section-label">
        <h1>Your history</h1>
        <span>{history.length} saved</span>
      </div>
      <p className="view-description">Saved on this device.</p>
      <div className="history-toolbar">
        <label className="history-search">
          <Search size={17} />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search your checks"
            aria-label="Search check history"
          />
        </label>
        <select
          className="history-verdict"
          aria-label="Filter history by verdict"
          value={verdictFilter}
          onChange={(event) => setVerdictFilter(event.target.value as Verdict | "ALL")}
        >
          <option value="ALL">{t("allFindings")}</option>
          {(["TRUE", "FALSE", "MIXED", "UNVERIFIED"] as const).map((verdict) => (
            <option key={verdict} value={verdict}>
              {labels[verdict].label}
            </option>
          ))}
        </select>
        <select
          className="history-sort"
          aria-label="Sort history"
          value={sort}
          onChange={(event) => setSort(event.target.value as HistorySort)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="sources">Most sources</option>
        </select>
        <details className="history-export">
          <summary className="secondary-button">
            <Download size={15} />
            Export
            <ArrowRight size={13} />
          </summary>
          <div className="export-options">
            {" "}
            <button
              className="text-button"
              disabled={!history.length}
              onClick={(event) => {
                downloadJson(history, "verity-history.json");
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              <Download size={16} />
              {t("exportJson")}
            </button>
            <button
              className="text-button"
              disabled={!history.length}
              onClick={(event) => {
                downloadCsv(history);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              <Download size={16} />
              {t("exportCsv")}
            </button>
          </div>
        </details>{" "}
        <input
          ref={importRef}
          className="sr-only"
          type="file"
          accept=".json,.csv"
          aria-label="Import history file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onImport(file);
            event.target.value = "";
          }}
        />
        <button className="text-button" onClick={() => importRef.current?.click()}>
          {t("importHistory")}
        </button>
        <button
          className="text-button danger-text"
          disabled={!history.length}
          onClick={() => {
            persist([], "History cleared");
            setResult(null);
          }}
        >
          <Trash2 size={16} />
          Clear history
        </button>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!filtered.length ? (
        <div className="empty-history">
          <EmptyArtwork />
          <h2>{history.length ? "No matching checks" : "No saved investigations"}</h2>
          <p>
            {history.length
              ? "Try a different search."
              : "Check a claim and it will appear in your private history."}
          </p>
          {history.length ? (
            <button
              className="secondary-button"
              onClick={() => {
                setFilter("");
                setVerdictFilter("ALL");
              }}
            >
              Clear search
              <X size={16} />
            </button>
          ) : (
            <button className="secondary-button" onClick={() => onStart()}>
              Check a claim
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="history-list">
          {rows.map((row) => (
            <article className="history-row" key={row.id}>
              <button className="history-open" onClick={() => openResult(row)}>
                <div>
                  <VerdictBadge verdict={row.verdict} />
                  <span className="history-date">{new Date(row.checked_at).toLocaleString()}</span>
                </div>
                <h2>{row.input}</h2>
                <p>{row.summary}</p>
                <div className="history-card-footer">
                  <span className="history-source-count">
                    <Link2 size={14} />
                    {sourceCount(row)} sources
                  </span>
                  <span className="open-finding">
                    Open finding
                    <ArrowUpRight size={14} />
                  </span>
                </div>
              </button>
              <button
                className="icon-button"
                aria-label={`Delete check: ${row.input.slice(0, 80)}`}
                onClick={() => {
                  persist(
                    history.filter((item) => item.id !== row.id),
                    "Check deleted",
                  );
                  if (result?.id === row.id) setResult(null);
                }}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
