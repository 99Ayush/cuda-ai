import { useState, useEffect, useRef, Fragment } from "react";
import {
  ArrowUpRight,
  Download,
  Copy,
  Check,
  Clock3,
  FileText,
  Link2,
  ChevronDown,
  RefreshCw,
  Share2,
} from "lucide-react";
import type { Result as CheckResult, Source } from "@claimlens/shared";
import VerdictBadge from "./components/VerdictBadge";
import { labels } from "./verdicts";
import { downloadJson } from "./storage.ts";
import { t } from "./messages";
import { SourceIcon } from "./components/Polish";
type Props = {
  result: CheckResult;
  onRecheck?: () => void;
  onShare?: () => Promise<void>;
  allowShare?: boolean;
  shared?: boolean;
};
function SourceCard({
  source,
  index,
  cited,
  quote,
}: {
  source: Source;
  index: number;
  cited: boolean;
  quote?: string;
}) {
  const domain = new URL(source.url).hostname.replace(/^www\./, "");
  const date = source.published_at || source.retrieved_at || "";
  const validDate = Number.isFinite(Date.parse(date));
  return (
    <article className={`source-card ${cited ? "source-cited" : ""}`}>
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        <div className="source-top">
          <span className="citation-number">{index + 1}</span>
          <SourceIcon url={source.url} />
          <span className="source-publisher">{domain}</span>
          <ArrowUpRight size={17} />
        </div>
        <h4>{source.title}</h4>
      </a>
      {(quote || source.quality) && (
        <details className="source-detail">
          <summary>
            {quote ? "Read cited excerpt" : "Source information"}
            <ChevronDown size={14} />
          </summary>
          {quote && (
            <blockquote className="source-quote">
              <mark>{quote}</mark>
            </blockquote>
          )}
          {source.quality && <p className="source-credibility">{source.quality.explanation}</p>}
        </details>
      )}
      <div className="source-card-meta">
        <span className={`source-use ${cited ? "cited" : ""}`}>
          {cited ? "Cited evidence" : "Additional source"}
        </span>
        {validDate ? (
          <time dateTime={date}>
            {source.published_at ? "Published" : "Retrieved"}{" "}
            {new Date(date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        ) : (
          <span>Date unavailable</span>
        )}
      </div>
      {source.quality && (
        <span className="source-quality" title={source.quality.explanation}>
          {source.quality.tier} source
        </span>
      )}
    </article>
  );
}
export default function Result({
  result,
  onRecheck,
  onShare,
  allowShare = false,
  shared = false,
}: Props) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    titleRef.current?.closest(".result-panel")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    titleRef.current?.focus({ preventScroll: true });
  }, [result.id]);
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState("");
  const { label, icon: Icon } = labels[result.verdict];
  const sources = [
    ...new Map(
      result.claims.flatMap((claim) => claim.sources).map((source) => [source.url, source]),
    ).values(),
  ];
  const sourceQuotes = new Map<string, string>();
  result.claims.forEach((claim) =>
    claim.evidence.forEach((evidence) => {
      const source = claim.sources.find((item) => item.id === evidence.source_id);
      if (source && !sourceQuotes.has(source.url)) sourceQuotes.set(source.url, evidence.quote);
    }),
  );
  const covered = result.claims.filter((claim) => claim.evidence.length > 0).length;
  const single = result.claims.length === 1;
  const citedUrls = new Set(
    result.claims.flatMap((claim) =>
      claim.evidence.flatMap((evidence) => {
        const source = claim.sources.find((item) => item.id === evidence.source_id);
        return source ? [source.url] : [];
      }),
    ),
  );
  const cited = sources.filter((source) => citedUrls.has(source.url)),
    primary = cited.length ? cited : sources.slice(0, 2),
    additional = sources.filter((source) => !primary.includes(source));
  async function copy() {
    const text = [
      result.input,
      `Verity: ${label}`,
      ...result.claims.map(
        (claim) => `${labels[claim.verdict].label}: ${claim.claim}\n${claim.explanation}`,
      ),
      ...sources.map((source) => source.url),
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Copy is unavailable in this browser. Download the report instead.");
    }
  }
  return (
    <article className="result-panel" aria-label="Fact-check result">
      <div className={`result-heading result-${result.verdict.toLowerCase()}`}>
        <div className="result-symbol">
          <Icon size={28} />
        </div>
        <div>
          <span className="eyebrow">{shared ? "Shared finding" : "Your finding"}</span>
          <h2 id="result-title" ref={titleRef} tabIndex={-1}>
            {label}
          </h2>
        </div>
        <dl className="evidence-overview" aria-label="Evidence overview">
          <div>
            <dt>Cited sources</dt>
            <dd>{cited.length}</dd>
          </div>
          <div>
            <dt>Claims with citations</dt>
            <dd>
              {covered}
              <span> / {result.claims.length}</span>
            </dd>
          </div>
        </dl>
      </div>
      <div className="checked-input">
        <span className="eyebrow">
          {result.input_type === "article" ? "Article reviewed" : "Claim checked"}
        </span>
        <p>{result.input}</p>
      </div>
      <p className="result-summary">{result.summary}</p>
      {result.demo && (
        <p className="notice" role="status">
          {t("demo")}
        </p>
      )}
      {result.warnings?.map((warning, index) => (
        <p className="notice" role="status" key={index}>
          {warning}
        </p>
      ))}
      {result.cached && (
        <p className="cache-note">
          Cached finding · {Math.round((result.cache_age_ms || 0) / 1000)} seconds old. Re-check to
          retrieve fresh evidence.
        </p>
      )}
      <div className="result-meta">
        <span>
          <Clock3 size={14} />
          {new Date(result.checked_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
        <span>
          <Link2 size={14} />
          {cited.length} cited · {sources.length} retrieved
        </span>
        <span>{(result.latency_ms / 1000).toFixed(1)}s</span>
      </div>
      {result.input_type === "article" && (
        <p className="article-scope">
          <FileText size={16} />
          Covers the selected claims in this article.
        </p>
      )}
      <div className="claim-findings">
        {result.claims.map((claim, index) => (
          <section className="claim-finding" key={index}>
            {!single && <div className="claim-number">{String(index + 1).padStart(2, "0")}</div>}
            <div className="claim-content">
              <div className="claim-top">
                <h3>{single ? "What the sources say" : claim.claim}</h3>
                {!single && <VerdictBadge verdict={claim.verdict} />}
              </div>
              {(!single || claim.explanation.trim() !== result.summary.trim()) && (
                <p>{claim.explanation}</p>
              )}
              <details className="evidence-detail">
                <summary>Evidence assessment</summary>
                <p>{claim.evidence_strength}</p>
                {typeof claim.confidence === "number" && (
                  <p>
                    Model estimate: {Math.round(claim.confidence * 100)}%. This is uncalibrated and
                    does not measure accuracy.
                  </p>
                )}
              </details>
              {!claim.evidence.length && (
                <p className="evidence-empty">
                  No cited excerpt established a supported or refuted finding.
                </p>
              )}
              {(["SUPPORTS", "REFUTES", "CONTEXT"] as const).map((stance) => {
                const items = claim.evidence.filter((item) => item.stance === stance);
                return items.length ? (
                  <Fragment key={stance}>
                    <h4 className="evidence-group-label">
                      {stance === "SUPPORTS"
                        ? "Supporting evidence"
                        : stance === "REFUTES"
                          ? "Refuting evidence"
                          : "Context"}
                    </h4>
                    {items.map((evidence, position) => {
                      const source = claim.sources.find((item) => item.id === evidence.source_id);
                      return source ? (
                        <blockquote
                          className={`evidence-quote evidence-${stance.toLowerCase()}`}
                          key={position}
                        >
                          <p>
                            <mark className="quoted-text">“{evidence.quote}”</mark>
                          </p>
                          <footer>
                            <span className={`stance stance-${stance.toLowerCase()}`}>
                              {stance === "SUPPORTS"
                                ? "Supports"
                                : stance === "REFUTES"
                                  ? "Refutes"
                                  : "Context"}
                            </span>
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              {source.publisher}
                              <ArrowUpRight size={13} />
                            </a>
                          </footer>
                        </blockquote>
                      ) : null;
                    })}
                  </Fragment>
                ) : null;
              })}
            </div>
          </section>
        ))}
      </div>
      {sources.length > 0 && (
        <section className="sources-section" id={`sources-${result.id}`}>
          <div className="section-title">
            <h3>{cited.length ? "Cited sources" : "Retrieved sources"}</h3>
            <span>
              {cited.length ? "Used in this finding" : "Not enough evidence for a verdict"}
            </span>
          </div>
          <div className="source-grid">
            {primary.map((source, index) => (
              <SourceCard
                key={source.url}
                source={source}
                index={index}
                cited={citedUrls.has(source.url)}
                quote={sourceQuotes.get(source.url)}
              />
            ))}
          </div>
          {additional.length > 0 && (
            <details className="sources-disclosure">
              <summary>
                View {additional.length} other {additional.length === 1 ? "source" : "sources"}
                <ChevronDown size={16} />
              </summary>
              <p>Additional sources, not cited in the finding.</p>
              <div className="source-grid">
                {additional.map((source, index) => (
                  <SourceCard
                    key={source.url}
                    source={source}
                    index={primary.length + index}
                    cited={false}
                    quote={sourceQuotes.get(source.url) || source.excerpts?.[0]?.quote}
                  />
                ))}
              </div>
            </details>
          )}
        </section>
      )}
      {result.trace && (
        <details className="verification-trace">
          <summary>How this was verified</summary>
          <ol>
            {result.trace.map((stage, index) => (
              <li key={index}>
                {stage.stage}: {stage.detail} · {(stage.duration_ms / 1000).toFixed(2)}s
              </li>
            ))}
          </ol>
          <p className="confidence-note">
            {result.model ? `Analysis model: ${result.model}. ` : ""}Source reputation is an
            editorial signal. Only validated citations can support a finding; uncertainty and
            freshness rules can force abstention.
          </p>
        </details>
      )}
      <div className="report-actions">
        <span className="report-action-label">Your report</span>
        <button
          className="text-button"
          onClick={() => {
            void copy();
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy summary"}
        </button>
        <button
          className="text-button"
          onClick={() => downloadJson(result, `claimlens-check-${result.id}.json`)}
        >
          <Download size={15} />
          Download
        </button>
        {!shared && onRecheck && (
          <button className="text-button" onClick={onRecheck}>
            <RefreshCw size={15} />
            {t("retry")}
          </button>
        )}
        {!shared && onShare && allowShare && (
          <button
            className="text-button"
            disabled={!allowShare}
            title={
              allowShare
                ? "Re-verify and explicitly store a public read-only finding"
                : "This server keeps findings local; download the report instead"
            }
            onClick={() => {
              void onShare();
            }}
          >
            <Share2 size={15} />
            {t("share")}
          </button>
        )}
      </div>
      {allowShare && !shared && (
        <p className="confidence-note">
          Creating a link opts this finding into server storage. Anyone with the link can read it.
        </p>
      )}
      {result.permalink && (
        <p className="notice">
          <a href={result.permalink}>Open read-only shared finding</a>
        </p>
      )}
      {copyError && (
        <p className="inline-error" role="alert">
          {copyError}
        </p>
      )}
    </article>
  );
}
