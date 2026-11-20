import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  CircleHelp,
  GitCompareArrows,
  Download,
  Copy,
  Check,
  Clock3,
  FileText,
  Link2,
  ChevronDown,
} from "lucide-react";
import { downloadJson } from "./storage.js";
const labels = {
  TRUE: {
    label: "Supported",
    icon: CheckCircle2,
    detail: "The retrieved evidence supports this claim.",
  },
  FALSE: {
    label: "Refuted",
    icon: XCircle,
    detail: "The retrieved evidence contradicts this claim.",
  },
  MIXED: {
    label: "Mixed findings",
    icon: GitCompareArrows,
    detail:
      "Some details need context, or not every claim could be established.",
  },
  UNVERIFIED: {
    label: "Unverified",
    icon: CircleHelp,
    detail: "The available evidence does not establish this claim.",
  },
};
export function VerdictBadge({ verdict }) {
  const { label, icon: Icon } = labels[verdict] || labels.UNVERIFIED;
  return (
    <span className={`verdict-badge verdict-${verdict?.toLowerCase()}`}>
      <Icon size={15} />
      {label}
    </span>
  );
}
function SourceCard({ source, index, cited }) {
  const published = Number.isFinite(Date.parse(source.published_at));
  return (
    <a className={`source-card ${cited ? "source-cited" : ""}`} href={source.url} target="_blank" rel="noopener noreferrer">
      <div className="source-top">
        <span className="source-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="source-publisher">{source.publisher}</span>
        <ArrowUpRight size={16} />
      </div>
      <h4>{source.title}</h4>
      <p>{source.content.slice(0, 180)}{source.content.length > 180 ? "…" : ""}</p>
      <div className="source-card-meta"><span className={`source-use ${cited ? "cited" : ""}`}>{cited ? "Cited evidence" : "Retrieved source"}</span><span>{source.provider || "Tavily"}</span></div>
      <span className="source-date">{published ? `Published ${new Date(source.published_at).toLocaleDateString()}` : "Publication date unavailable"}</span>
    </a>
  );
}
export default function Result({ result }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const { label, icon: Icon, detail } = labels[result.verdict];
  const sources = [
    ...new Map(
      result.claims.flatMap((c) => c.sources).map((s) => [s.url, s]),
    ).values(),
  ];
  const singleClaim = result.claims.length === 1;
  const citedUrls = new Set(result.claims.flatMap(claim => claim.evidence.flatMap(evidence => {
    const source = claim.sources.find(item => item.id === evidence.source_id);
    return source ? [source.url] : [];
  })));
  const citedSources = sources.filter(source => citedUrls.has(source.url));
  const primarySources = citedSources.length ? citedSources : sources.slice(0, 2);
  const additionalSources = sources.filter(source => !primarySources.includes(source));
  async function copy() {
    const text = [
      result.input,
      `CUDA AI: ${label}`,
      ...result.claims.map(
        (c) => `${labels[c.verdict].label}: ${c.claim}\n${c.explanation}`,
      ),
      ...sources.map((s) => s.url),
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError(
        "Copy is unavailable in this browser. You can download the report instead.",
      );
    }
  }
  return (
    <article className="result-panel" aria-label="Fact-check result">
      <div className={`result-heading result-${result.verdict.toLowerCase()}`}>
        <div className="result-symbol">
          <Icon size={28} />
        </div>
        <div>
          <span className="eyebrow">THE FINDING</span>
          <h2 id="result-title" tabIndex={-1}>{label}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className="checked-input">
        <span className="eyebrow">
          {result.input_type === "article"
            ? "ARTICLE REVIEWED"
            : "CLAIM CHECKED"}
        </span>
        <p>{result.input}</p>
      </div>
      <p className="result-summary">{result.summary}</p>
      {result.warnings?.map((warning, index) => <p className="notice" role="status" key={index}>{warning}</p>)}
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
          {citedSources.length} cited · {sources.length} retrieved
        </span>
        <span>{(result.latency_ms / 1000).toFixed(1)}s</span>
      </div>
      {result.input_type === "article" && (
        <p className="article-scope">
          <FileText size={16} />
          This review covers up to three key claims extracted from the article,
          rather than every statement.
        </p>
      )}
      <div className="claim-findings">
        {result.claims.map((claim, index) => (
          <section className="claim-finding" key={index}>
            {!singleClaim && <div className="claim-number">
              {String(index + 1).padStart(2, "0")}
            </div>}
            <div className="claim-content">
              <div className="claim-top">
                <h3>{singleClaim ? "Evidence for this finding" : claim.claim}</h3>
                {!singleClaim && <VerdictBadge verdict={claim.verdict} />}
              </div>
              {(!singleClaim || claim.explanation.trim() !== result.summary.trim()) && <p>{claim.explanation}</p>}
              <span className="evidence-strength">
                {claim.evidence_strength}
              </span>
              {!claim.evidence.length && <p className="evidence-empty">No cited excerpt established a supported or refuted finding.</p>}
              {claim.evidence.map((e, i) => {
                const source = claim.sources.find((s) => s.id === e.source_id);
                return (
                  <blockquote className={`evidence-quote evidence-${e.stance.toLowerCase()}`} key={i}>
                    <p>“{e.quote}”</p>
                    <footer>
                      <span
                        className={`stance stance-${e.stance.toLowerCase()}`}
                      >
                        {e.stance === "SUPPORTS"
                          ? "Supports"
                          : e.stance === "REFUTES"
                            ? "Refutes"
                            : "Context"}
                      </span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.publisher}
                        <ArrowUpRight size={13} />
                      </a>
                    </footer>
                  </blockquote>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {sources.length > 0 && (
        <section className="sources-section">
          <div className="section-title">
            <h3>{citedSources.length ? "Cited sources" : "Retrieved sources"}</h3>
            <span>{citedSources.length ? "Used in this finding" : "Not enough evidence for a verdict"}</span>
          </div>
          <div className="source-grid">
            {primarySources.map((source, index) => <SourceCard key={source.url} source={source} index={index} cited={citedUrls.has(source.url)} />)}
          </div>
          {additionalSources.length > 0 && <details className="sources-disclosure"><summary>Show {additionalSources.length} additional retrieved {additionalSources.length === 1 ? "source" : "sources"}<ChevronDown size={16} /></summary><p>These were retrieved for this check and are not cited in the finding above.</p><div className="source-grid">{additionalSources.map((source, index) => <SourceCard key={source.url} source={source} index={primarySources.length + index} cited={false} />)}</div></details>}
        </section>
      )}
      <div className="report-actions">
        <p>AI-assisted analysis. Open the sources and judge their relevance.</p>
        <button className="text-button" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy summary"}
        </button>
        <button
          className="text-button"
          onClick={() =>
            downloadJson(result, `cuda-ai-check-${result.id}.json`)
          }
        >
          <Download size={15} />
          Download
        </button>
      </div>
      {copyError && (
        <p role="alert" className="inline-error">
          {copyError}
        </p>
      )}
    </article>
  );
}
