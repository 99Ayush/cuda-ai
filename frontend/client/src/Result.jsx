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
export default function Result({ result }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const { label, icon: Icon, detail } = labels[result.verdict];
  const sources = [
    ...new Map(
      result.claims.flatMap((c) => c.sources).map((s) => [s.url, s]),
    ).values(),
  ];
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
          <h2>{label}</h2>
          <p>{detail}</p>
        </div>
        <VerdictBadge verdict={result.verdict} />
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
          {sources.length} retrieved{" "}
          {sources.length === 1 ? "source" : "sources"}
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
            <div className="claim-number">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="claim-content">
              <div className="claim-top">
                <h3>{claim.claim}</h3>
                <VerdictBadge verdict={claim.verdict} />
              </div>
              <p>{claim.explanation}</p>
              <span className="evidence-strength">
                {claim.evidence_strength}
              </span>
              {claim.evidence.map((e, i) => {
                const source = claim.sources.find((s) => s.id === e.source_id);
                return (
                  <blockquote key={i}>
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
            <h3>Read the sources</h3>
            <span>Retrieved for this check</span>
          </div>
          <div className="source-grid">
            {sources.map((source, index) => (
              <a
                className="source-card"
                href={source.url}
                key={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="source-top">
                  <span className="source-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{source.publisher}</span>
                  <ArrowUpRight size={17} />
                </div>
                <h4>{source.title}</h4>
                <p>
                  {source.content.slice(0, 180)}
                  {source.content.length > 180 ? "…" : ""}
                </p>
                <span className="source-date">
                  {source.published_at
                    ? `Published ${new Date(source.published_at).toLocaleDateString()}`
                    : "Publication date not supplied"}
                </span>
              </a>
            ))}
          </div>
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
