import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  History,
  Link2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Download,
  CircleAlert,
  Globe2,
  Quote,
} from "lucide-react";
import { apiRequest } from "./api.js";
import {
  readHistory,
  saveHistory,
  validResult,
  downloadJson,
} from "./storage.js";
import Result, { VerdictBadge } from "./Result.jsx";

const examples = [
  "Humans use only 10% of their brains.",
  "Lightning never strikes the same place twice.",
  "The Great Wall of China is visible from the Moon.",
];
function incomingClaim() {
  try {
    return (
      new URLSearchParams(window.location.hash.slice(1))
        .get("claim")
        ?.slice(0, 2000) || ""
    );
  } catch {
    return "";
  }
}
export default function App() {
  const [view, setView] = useState("check");
  const [mode, setMode] = useState("claim");
  const [claim, setClaim] = useState(incomingClaim);
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState(readHistory);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState({ status: "checking" });
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const controller = useRef(null);
  const checking = useRef(false);
  const resultRef = useRef(null);
  const fieldRef = useRef(null);
  useEffect(() => {
    let alive = true;
    const signal = new AbortController();
    async function checkHealth() {
      try {
        const data = await apiRequest("health", { signal: signal.signal });
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth({ status: "unreachable" });
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    const storageChanged = () => setHistory(readHistory());
    window.addEventListener("storage", storageChanged);
    if (window.location.hash.startsWith("#claim="))
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    return () => {
      alive = false;
      signal.abort();
      clearInterval(interval);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [loading]);
  useEffect(() => () => controller.current?.abort(), []);
  function persist(next) {
    setHistory(next);
    if (!saveHistory(next))
      setNotice(
        "Browser storage is unavailable or full. This check remains visible, but may not survive a reload. Download it to keep a copy.",
      );
  }
  async function submit(event) {
    event.preventDefault();
    if (checking.current) return;
    checking.current = true;
    controller.current = new AbortController();
    setLoading(true);
    setElapsed(0);
    setError("");
    setNotice("");
    setResult(null);
    try {
      const data = await apiRequest("analyze-claim", {
        method: "POST",
        body: JSON.stringify(
          mode === "claim" ? { text: claim.trim() } : { pageUrl: url.trim() },
        ),
        signal: controller.current.signal,
      });
      if (!validResult(data))
        throw new Error(
          "The service returned an incomplete result. Please try again.",
        );
      setResult(data);
      persist(
        [data, ...readHistory().filter((row) => row.id !== data.id)].slice(
          0,
          50,
        ),
      );
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      checking.current = false;
      setLoading(false);
    }
  }
  function chooseExample(text) {
    setView("check");
    setMode("claim");
    setClaim(text);
    setError("");
    requestAnimationFrame(() => fieldRef.current?.focus());
  }
  function openResult(row) {
    setResult(row);
    setView("check");
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  const filtered = history.filter((row) =>
    row.input.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => setView("check")}
            aria-label="CUDA AI home"
          >
            <span className="brand-icon">
              <ShieldCheck size={23} />
            </span>
            <span>
              cuda<span className="brand-ai">ai</span>
              <span className="brand-dot">.</span>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={view === "check" ? "active" : ""}
              onClick={() => setView("check")}
            >
              <Search size={16} />
              Fact check
            </button>
            <button
              className={view === "history" ? "active" : ""}
              onClick={() => setView("history")}
            >
              <History size={16} />
              My history
              {history.length > 0 && (
                <span className="nav-count">{history.length}</span>
              )}
            </button>
          </nav>
          <div className={`service-status status-${health.status}`}>
            <span />
            {health.test_mode
              ? "Test preview"
              : health.status === "ready"
                ? "Ready to check"
                : health.status === "checking"
                  ? "Connecting"
                  : health.status === "setup_required"
                    ? "Setup needed"
                    : "Service unavailable"}
          </div>
        </div>
      </header>
      <main id="main" className="main-container">
        {view === "check" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="hero-kicker">
                  <span />
                  EVIDENCE BEFORE OPINION
                </div>
                <h1>
                  Before you share it,
                  <br />
                  <span>check the facts.</span>
                </h1>
                <p>
                  Bring a claim. We’ll look for the evidence, compare what the
                  sources say, and show you what holds up.
                </p>
              </div>
              <div className="hero-graphic" aria-hidden="true">
                <div className="orbital orbital-one" />
                <div className="orbital orbital-two" />
                <div className="orbital orbital-three" />
                <div className="graphic-core">
                  <ShieldCheck size={50} strokeWidth={1.3} />
                </div>
                <span className="graphic-label graphic-label-one">
                  <Globe2 size={14} />
                  Find evidence
                </span>
                <span className="graphic-label graphic-label-two">
                  <Quote size={14} />
                  Compare sources
                </span>
                <span className="graphic-label graphic-label-three">
                  <Check size={14} />
                  Show the finding
                </span>
                <div className="orbital-dot dot-one" />
                <div className="orbital-dot dot-two" />
              </div>
            </section>
            <section
              className="check-panel"
              aria-label="Check a claim or article"
            >
              <div
                className="input-tabs"
                role="tablist"
                aria-label="Input type"
              >
                <button
                  id="claim-tab"
                  type="button"
                  role="tab"
                  aria-selected={mode === "claim"}
                  aria-controls="check-input"
                  className={mode === "claim" ? "selected" : ""}
                  onClick={() => {
                    setMode("claim");
                    setError("");
                  }}
                  disabled={loading}
                >
                  <FileText size={16} />A claim
                </button>
                <button
                  id="article-tab"
                  type="button"
                  role="tab"
                  aria-selected={mode === "article"}
                  aria-controls="check-input"
                  className={mode === "article" ? "selected" : ""}
                  onClick={() => {
                    setMode("article");
                    setError("");
                  }}
                  disabled={loading}
                >
                  <Link2 size={16} />
                  An article URL
                </button>
                <span className="input-hint">
                  A clear claim gets a better check
                </span>
              </div>
              <form
                id="check-input"
                role="tabpanel"
                aria-labelledby={mode === "claim" ? "claim-tab" : "article-tab"}
                onSubmit={submit}
              >
                <label htmlFor="claim-input" className="input-label">
                  {mode === "claim"
                    ? "What would you like to verify?"
                    : "Paste the article you want to review"}
                </label>
                {mode === "claim" ? (
                  <textarea
                    id="claim-input"
                    ref={fieldRef}
                    value={claim}
                    onChange={(e) => setClaim(e.target.value)}
                    minLength={8}
                    maxLength={2000}
                    required
                    rows={3}
                    disabled={loading}
                    placeholder="For example: Lightning never strikes the same place twice."
                    aria-describedby="input-description"
                  />
                ) : (
                  <input
                    id="claim-input"
                    ref={fieldRef}
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    maxLength={2048}
                    required
                    disabled={loading}
                    placeholder="https://example.com/article"
                    aria-describedby="input-description"
                  />
                )}
                <div className="form-bottom">
                  <p id="input-description">
                    {mode === "claim"
                      ? `${claim.length.toLocaleString()} / 2,000 characters`
                      : "We read the article and check up to three key claims."}
                  </p>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      loading ||
                      health.status === "setup_required" ||
                      (mode === "claim" ? claim.trim().length < 8 : !url.trim())
                    }
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="spin" size={17} />
                        Checking…
                      </>
                    ) : (
                      <>
                        Check the facts
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </div>
              </form>
              {loading && (
                <div className="checking-status" role="status">
                  <LoaderCircle size={16} className="spin" />
                  <div>
                    <strong>Finding sources and comparing the evidence</strong>
                    <span>
                      {elapsed}s elapsed · Complex checks can take about a
                      minute.
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => controller.current?.abort()}
                  >
                    <X size={15} />
                    Cancel
                  </button>
                </div>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  <CircleAlert size={19} />
                  <div>
                    <strong>This check wasn’t completed</strong>
                    <p>{error}</p>
                  </div>
                </div>
              )}
              {health.status === "setup_required" && (
                <div className="error-banner" role="status">
                  <CircleAlert size={19} />
                  <div>
                    <strong>The service needs configuration</strong>
                    <p>
                      The site owner needs to configure its Gemini and Tavily
                      API keys before checks can run.
                    </p>
                  </div>
                </div>
              )}
              <div className="privacy-note">
                <ShieldCheck size={14} />
                <span>
                  Your input is sent to our search and analysis providers. Your
                  check history stays in this browser.
                </span>
              </div>
            </section>
            {!result && (
              <div className="examples">
                <span>TRY A CLAIM</span>
                {examples.map((text) => (
                  <button
                    key={text}
                    disabled={loading}
                    onClick={() => chooseExample(text)}
                  >
                    {text}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            <div ref={resultRef} className="result-anchor" aria-live="polite">
              {result && <Result result={result} key={result.id} />}
            </div>
            {!result && history.length > 0 && (
              <section className="recent-section">
                <div className="section-title">
                  <h2>Your recent checks</h2>
                  <button
                    className="text-button"
                    onClick={() => setView("history")}
                  >
                    View history
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="recent-grid">
                  {history.slice(0, 3).map((row) => (
                    <button
                      className="recent-card"
                      key={row.id}
                      onClick={() => openResult(row)}
                    >
                      <VerdictBadge verdict={row.verdict} />
                      <h3>{row.input}</h3>
                      <span>
                        {new Date(row.checked_at).toLocaleDateString()}
                        <ArrowUpRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section id="method" className="method-section">
              <div className="section-title">
                <h2>A finding you can inspect.</h2>
                <span>How a check works</span>
              </div>
              <div className="method-grid">
                <div>
                  <span className="step-number">01</span>
                  <Globe2 size={21} />
                  <h3>Look beyond the headline</h3>
                  <p>
                    We search the web for evidence relevant to your claim.
                    Article checks start by reading the page.
                  </p>
                </div>
                <div>
                  <span className="step-number">02</span>
                  <BookOpen size={21} />
                  <h3>Compare the evidence</h3>
                  <p>
                    The analysis weighs the retrieved sources and separates
                    support, contradictions, and missing context.
                  </p>
                </div>
                <div>
                  <span className="step-number">03</span>
                  <ShieldCheck size={21} />
                  <h3>Keep the sources in view</h3>
                  <p>
                    Read the source excerpts and original pages. When evidence
                    is insufficient, the finding stays unverified.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="history-section">
            <div className="history-heading">
              <div className="eyebrow">YOUR RESEARCH, IN ONE PLACE</div>
              <h1>
                My history<span className="brand-dot">.</span>
              </h1>
              <p>
                Up to 50 checks saved on this device. Your history is never
                shared with other visitors.
              </p>
            </div>
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
              <button
                className="text-button"
                disabled={!history.length}
                onClick={() => downloadJson(history, "cuda-ai-history.json")}
              >
                <Download size={16} />
                Export
              </button>
              <button
                className="text-button danger-text"
                disabled={!history.length}
                onClick={() => {
                  persist([]);
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
                <History size={32} />
                <h2>
                  {history.length
                    ? "No matching checks"
                    : "Your first finding starts here"}
                </h2>
                <p>
                  {history.length
                    ? "Try a different search."
                    : "Check a claim and it will appear in your private history."}
                </p>
                {!history.length && (
                  <button
                    className="primary-button"
                    onClick={() => setView("check")}
                  >
                    Check a claim
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
            ) : (
              <div className="history-list">
                {filtered.map((row) => (
                  <article className="history-row" key={row.id}>
                    <button
                      className="history-open"
                      onClick={() => openResult(row)}
                    >
                      <div>
                        <VerdictBadge verdict={row.verdict} />
                        <span className="history-date">
                          {new Date(row.checked_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <h2>{row.input}</h2>
                      <p>{row.summary}</p>
                      <span className="open-finding">
                        Open finding
                        <ArrowUpRight size={14} />
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete check: ${row.input.slice(0, 80)}`}
                      onClick={() => {
                        persist(history.filter((item) => item.id !== row.id));
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
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <ShieldCheck size={17} />
          cuda ai
        </span>
        <p>Evidence helps. Context matters. AI can make mistakes.</p>
        <a
          href="https://github.com/99Ayush/cuda-ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open source
          <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
