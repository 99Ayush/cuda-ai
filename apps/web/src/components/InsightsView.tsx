import { ArrowRight } from "lucide-react";
import type { Result } from "@claimlens/shared";
import VerdictBadge from "./VerdictBadge";
import { EmptyArtwork } from "./Polish";
import { labels } from "../verdicts";

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}
export default function InsightsView({
  history,
  onStart,
}: {
  history: Result[];
  onStart: () => void;
}) {
  if (!history.length)
    return (
      <section className="stats-view">
        <div className="page-heading">
          <h1>Your check activity</h1>
          <p>Patterns from your saved investigations.</p>
        </div>
        <div className="empty-history">
          <EmptyArtwork />
          <h2>No activity yet</h2>
          <p>Check a claim to start your history and activity.</p>
          <button className="secondary-button" onClick={onStart}>
            Check your first claim
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    );
  const average = (
    history.reduce((sum, row) => sum + row.latency_ms, 0) /
    history.length /
    1000
  ).toFixed(1);
  const sourceAverage = (
    history.reduce(
      (sum, row) =>
        sum +
        (row.source_count ??
          new Set(row.claims.flatMap((claim) => claim.sources.map((source) => source.url))).size),
      0,
    ) / history.length
  ).toFixed(1);
  const claims = history.flatMap((row) => row.claims);
  const covered = claims.filter((claim) =>
    claim.evidence.some((item) => item.stance !== "CONTEXT"),
  ).length;
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13 + index);
    return {
      date,
      count: history.filter((row) => dayKey(new Date(row.checked_at)) === dayKey(date)).length,
    };
  });
  const maximum = Math.max(1, ...days.map((day) => day.count));
  const recent = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <section className="stats-view" aria-label="Your check statistics">
      <div className="page-heading">
        <h1>Your check activity</h1>
        <p>From the checks saved in this browser.</p>
      </div>
      <div className="statistics-summary">
        <span>
          Total checks <strong>{history.length}</strong>
        </span>
        <span>
          Average check time <strong>{average}s</strong>
        </span>
        <span>
          Average sources <strong>{sourceAverage}</strong>
        </span>
      </div>
      <div className="insights-overview">
        <section className="insight-panel" aria-labelledby="activity-title">
          <div className="insight-heading">
            <div>
              <h2 id="activity-title">Investigation activity</h2>
              <p>Last 14 days</p>
            </div>
            <span>
              {recent} {recent === 1 ? "check" : "checks"}
            </span>
          </div>
          <ol className="activity-chart" aria-label="Daily saved investigations">
            {days.map((day, index) => (
              <li
                key={dayKey(day.date)}
                title={`${day.date.toLocaleDateString()}: ${day.count} saved ${day.count === 1 ? "check" : "checks"}`}
              >
                <span className="sr-only">
                  {day.date.toLocaleDateString()}: {day.count} checks
                </span>
                <div className="activity-track" aria-hidden="true">
                  <span
                    className="activity-bar"
                    style={{ height: `${(day.count / maximum) * 100}%` }}
                  />
                </div>
                <span className="activity-date" aria-hidden="true">
                  {[0, 6, 13].includes(index)
                    ? day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : ""}
                </span>
              </li>
            ))}
          </ol>
          {recent === 0 && <p className="chart-note">No saved checks in this period.</p>}
        </section>
        <section className="insight-panel evidence-coverage" aria-labelledby="coverage-title">
          <div className="insight-heading">
            <div>
              <h2 id="coverage-title">Evidence coverage</h2>
              <p>Supporting or contradicting citations</p>
            </div>
          </div>
          <div className="coverage-number">
            <strong>{claims.length ? Math.round((covered / claims.length) * 100) : 0}%</strong>
            <span>
              {covered} of {claims.length} claims
            </span>
          </div>
          <progress
            value={covered}
            max={claims.length || 1}
            aria-label="Claims with directional citations"
          />
          <p className="chart-note">
            Citation coverage measures available evidence, not factual accuracy or model confidence.
          </p>
        </section>
      </div>
      <div className="insight-section-heading">
        <h2>Verdict distribution</h2>
        <span>{history.length} saved reports</span>
      </div>
      <div className="stats-grid">
        {(["TRUE", "FALSE", "MIXED", "UNVERIFIED"] as const).map((verdict) => {
          const count = history.filter((row) => row.verdict === verdict).length;
          return (
            <div className={`stat-card stat-${verdict.toLowerCase()}`} key={verdict}>
              <VerdictBadge verdict={verdict} />
              <strong>{count}</strong>
              <progress
                value={count}
                max={history.length}
                aria-label={`${labels[verdict].label} share of saved checks`}
              />
              <span>{Math.round((count / history.length) * 100)}% of saved checks</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
