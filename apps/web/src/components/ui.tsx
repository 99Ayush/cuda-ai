import { useEffect, useState } from "react";
import { Check, CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react";
import type { ToastItem } from "../hooks";
import type { ProgressEvent, Verdict } from "@verity/shared";
import { labels } from "../types";

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { label, icon: Icon } = labels[verdict];
  return (
    <span className={`verdict-badge verdict-${verdict.toLowerCase()}`}>
      <Icon size={15} />
      {label}
    </span>
  );
}

function Toast({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = setTimeout(() => dismiss(item.id), 5500);
    return () => clearTimeout(timeout);
  }, [item.id, dismiss]);
  return (
    <div className={`toast toast-${item.tone}`} role="status">
      {item.tone === "error" ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}
      <p>{item.message}</p>
      <button
        className="icon-button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(item.id)}
      >
        <X size={18} />
      </button>
    </div>
  );
}
export function ToastStack({
  items,
  dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="toast-stack" aria-live="polite" aria-label="Notifications">
      {items.map((item) => (
        <Toast key={item.id} item={item} dismiss={dismiss} />
      ))}
    </div>
  );
}
export function ProgressSkeleton({
  progress,
  elapsed,
  onCancel,
}: {
  progress: ProgressEvent | null;
  elapsed: number;
  onCancel: () => void;
}) {
  const step =
    progress?.stage === "validating" || progress?.stage === "complete"
      ? 3
      : progress?.stage === "analyzing"
        ? 2
        : ["queries", "searching", "reading"].includes(progress?.stage || "")
          ? 1
          : 0;
  const steps = ["Prepare claim", "Find evidence", "Analyze sources", "Validate finding"];
  return (
    <section className="progress-panel" aria-label="Verification progress">
      <div className="progress-heading">
        <div>
          <span className="eyebrow">Check in progress</span>
          <h2>Following the evidence</h2>
          <p role="status">{progress?.detail || "Preparing your check…"}</p>
        </div>
        <button className="secondary-button" onClick={onCancel}>
          <X size={16} />
          Cancel check
        </button>
      </div>
      <ol className="progress-steps">
        {steps.map((label, index) => (
          <li
            key={label}
            className={index < step ? "done" : index === step ? "current" : "waiting"}
            aria-current={index === step ? "step" : undefined}
          >
            <span>
              {index < step ? (
                <Check size={14} />
              ) : index === step ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                index + 1
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div className="result-skeleton" aria-hidden="true">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
        <div className="skeleton-source-grid">
          {[0, 1, 2].map((index) => (
            <div className="skeleton-source" key={index}>
              <div className="skeleton skeleton-avatar" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-line short" />
            </div>
          ))}
        </div>
      </div>
      <span className="progress-time">{elapsed}s elapsed</span>
    </section>
  );
}
export function SourceIcon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  let host = "",
    icon = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "");
    if (
      /^[a-z0-9.-]+$/i.test(host) &&
      host.includes(".") &&
      !/^\d+\./.test(host) &&
      !/\.(local|internal)$/.test(host) &&
      host !== "localhost"
    )
      icon = `https://${parsed.hostname}/favicon.ico`;
  } catch {}
  return (
    <span className="source-favicon" aria-hidden="true">
      {!loaded && <span>{host.slice(0, 1).toUpperCase() || "S"}</span>}
      {icon && !failed ? (
        <img
          src={icon}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={loaded ? "favicon-loaded" : "favicon-pending"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
export function EmptyArtwork() {
  return (
    <svg className="empty-artwork" viewBox="0 0 128 112" fill="none" aria-hidden="true">
      <rect
        x="34"
        y="20"
        width="64"
        height="78"
        rx="10"
        transform="rotate(8 34 20)"
        fill="var(--surface-raised)"
        stroke="var(--line-strong)"
      />
      <rect
        x="25"
        y="13"
        width="64"
        height="78"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line-strong)"
      />
      <path
        d="M39 34h35M39 47h27M39 60h31"
        stroke="var(--muted)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="88" cy="80" r="20" fill="var(--surface-raised)" stroke="var(--color-accent)" />
      <path
        d="m81 80 5 5 10-11"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
