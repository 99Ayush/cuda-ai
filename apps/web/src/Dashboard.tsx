import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Download,
  Globe2,
  History,
  LayoutGrid,
  LoaderCircle,
  Lock,
  Search,
  Settings as SettingsIcon,
  Shield,
  Target,
  Terminal,
  Trash2,
  X,
  Zap,
  Sun,
  Moon,
  Command,
  type LucideIcon,
} from "lucide-react";
import type { Health, Result as CheckResult, Verdict } from "@claimlens/shared";
import type { DashboardProps, DialogKind } from "./types";
import Settings from "./Settings";
import VerdictBadge from "./components/VerdictBadge";
import Commands from "./components/Commands";
import { labels } from "./verdicts";
import { t } from "./messages";
import { downloadJson, downloadCsv } from "./storage.ts";
const Result = lazy(() => import("./Result.tsx"));

function NavItem({
  icon: Icon,
  label,
  title,
  active,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`rail-item ${active ? "active" : ""}`}
      aria-label={title}
      aria-current={active ? "page" : undefined}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}
function StatusRow({
  label,
  value,
  state = "good",
}: {
  label: string;
  value: string;
  state?: string;
}) {
  return (
    <div className="telemetry-row">
      <span className={`status-dot ${state}`} />
      <span>{label}</span>
      <i />
      <strong className={`status-tag ${state}`}>{value}</strong>
    </div>
  );
}
function InfoDialog({
  kind,
  health,
  onClose,
}: {
  kind: DialogKind;
  health: Health;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const titles = {
    mesh: "VERIFICATION_NETWORK",
    dev: "SERVICE_DIAGNOSTICS",
    lock: "SECURITY_PROTOCOL_v2",
  };
  return (
    <dialog
      ref={ref}
      className="system-dialog"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{titles[kind]}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {kind === "mesh" ? (
        <>
          <p>
            Tavily retrieves web evidence. Gemini compares the excerpts with your claim, and the
            server validates citations and quotations.
          </p>
          <StatusRow
            label="Evidence provider"
            value={health.configured?.evidence ? "CONFIGURED" : "UNAVAILABLE"}
            state={health.configured?.evidence ? "good" : "idle"}
          />
          <StatusRow
            label="Analysis provider"
            value={health.configured?.analysis ? "CONFIGURED" : "UNAVAILABLE"}
            state={health.configured?.analysis ? "good" : "idle"}
          />
          <p>
            Configuration status does not guarantee provider availability. Open the cited sources to
            assess each finding.
          </p>
        </>
      ) : kind === "dev" ? (
        <>
          <StatusRow
            label="Service status"
            value={health.status.toUpperCase()}
            state={health.status === "ready" ? "good" : "idle"}
          />
          <StatusRow label="API version" value={health.version || "UNKNOWN"} state="idle" />
          <StatusRow
            label="Provider mode"
            value={health.test_mode ? "TEST FIXTURES" : "LIVE"}
            state={health.test_mode ? "idle" : "good"}
          />
          <p>
            {health.test_mode
              ? "This local preview uses controlled test responses. It does not perform live fact checking."
              : "API keys are kept on the server. This view never displays credentials."}
          </p>
        </>
      ) : (
        <>
          <p>
            Your input is sent to our search and analysis providers for checking. Avoid including
            sensitive personal information.
          </p>
          <p>
            Up to 50 checks stay in this browser. They are not saved in a shared server history. Use
            History to export or delete your saved checks.
          </p>
          <p>
            Production connections use HTTPS. Browser history is local storage and is not encrypted
            by this application.
          </p>
          <div className="security-tags">
            <span>SERVER_SIDE_KEYS</span>
            <span>LOCAL_HISTORY</span>
          </div>
        </>
      )}
    </dialog>
  );
}
function Standby({
  ready,
  latency,
  onExample,
}: {
  ready: boolean;
  latency?: number;
  onExample: (value: string) => void;
}) {
  const examples = [
    { label: "The Sun is a planet", claim: "The Sun is a planet." },
    {
      label: "Lightning never strikes twice",
      claim: "Lightning never strikes the same place twice.",
    },
  ];
  return (
    <div className="standby-panel">
      <span className="corner top-left" />
      <span className="corner top-right" />
      <span className="corner bottom-left" />
      <span className="corner bottom-right" />
      <div className="radar">
        <div className="radar-ring outer" />
        <div className="radar-ring inner" />
        <div className="radar-sweep" />
        <div className="radar-core">
          <Target size={32} />
        </div>
      </div>
      <h1>{t("startHeadline")}</h1>
      <p className="standby-subtitle">{t("startDescription")}</p>
      <div className="example-claims">
        <span>Try an example</span>
        <div>
          {examples.map((example) => (
            <button key={example.claim} onClick={() => onExample(example.claim)}>
              {example.label}
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      </div>
      <div className="standby-metrics">
        <div>
          <span>LAST CHECK</span>
          <strong className="green">{latency ? `${(latency / 1000).toFixed(1)}s` : "—"}</strong>
        </div>
        <div>
          <span>PROVIDERS</span>
          <strong className="blue">{ready ? "CONFIGURED" : "WAITING"}</strong>
        </div>
        <div>
          <span>HISTORY</span>
          <strong className="amber">LOCAL</strong>
        </div>
      </div>
    </div>
  );
}
function Stats({ history }: { history: CheckResult[] }) {
  return (
    <section className="stats-view" aria-label="Your check statistics">
      <div className="section-label">
        <h1>INVESTIGATION_STATS</h1>
        <span>THIS_BROWSER</span>
      </div>
      <p className="view-description">Statistics from your saved checks on this device.</p>
      <div className="stats-grid">
        {(["TRUE", "FALSE", "MIXED", "UNVERIFIED"] as const).map((verdict) => {
          const count = history.filter((row) => row.verdict === verdict).length;
          return (
            <div className="stat-card" key={verdict}>
              <VerdictBadge verdict={verdict} />
              <strong>{count}</strong>
              <progress
                value={count}
                max={history.length || 1}
                aria-label={`${verdict} share of saved checks`}
              />
            </div>
          );
        })}
      </div>
      <div className="statistics-summary">
        <span>
          TOTAL_SCANS <strong>{history.length}</strong>
        </span>
        <span>
          AVERAGE_LATENCY{" "}
          <strong>
            {history.length
              ? `${(history.reduce((sum, row) => sum + row.latency_ms, 0) / history.length / 1000).toFixed(1)}s`
              : "—"}
          </strong>
        </span>
      </div>
      {!history.length && (
        <p className="view-description">
          Run your first scan to start building your investigation history.
        </p>
      )}
    </section>
  );
}

export default function Dashboard({
  view,
  setView,
  claim,
  setClaim,
  history,
  result,
  health,
  loading,
  elapsed,
  error,
  notice,
  filter,
  setFilter,
  verdictFilter,
  setVerdictFilter,
  filtered,
  controller,
  resultRef,
  fieldRef,
  submit,
  openResult,
  persist,
  setResult,
  progress,
  articleClaims,
  selectedClaims,
  setSelectedClaims,
  preparedArticle,
  onImport,
  onRecheck,
  onShare,
  shared,
}: DashboardProps) {
  const [clock, setClock] = useState(() => new Date());
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [commands, setCommands] = useState<"commands" | "help" | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("claimlens-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const importRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("claimlens-theme", theme);
    } catch {}
  }, [theme]);
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view]);
  const ready = health.status === "ready";
  const latest = result || history[0];
  const isArticle = /^https?:\/\//i.test(claim.trim());
  const status = health.test_mode
    ? "TEST_MODE"
    : ready
      ? "CONFIGURED"
      : health.status === "checking"
        ? "CHECKING"
        : health.status === "setup_required"
          ? "SETUP_NEEDED"
          : "UNREACHABLE";
  function useExample(value: string) {
    setClaim(value);
    requestAnimationFrame(() => fieldRef.current?.focus());
  }
  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 60000);
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setView("check");
        requestAnimationFrame(() => fieldRef.current?.focus());
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommands("commands");
      }
      if (
        event.key === "?" &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,[contenteditable]")
        )
      )
        setCommands("help");
    }
    window.addEventListener("keydown", shortcut);
    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", shortcut);
    };
  }, [setView, fieldRef]);

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="scanlines" aria-hidden="true" />
      <aside className="navigation-rail">
        <button className="rail-logo" onClick={() => setView("check")} aria-label="ClaimLens home">
          <Shield size={23} />
        </button>
        <div className="rail-divider" />
        <nav className="rail-nav" aria-label="Main navigation">
          <NavItem
            icon={Activity}
            label="Check"
            title="Investigate"
            active={view === "check"}
            onClick={() => setView("check")}
          />
          <NavItem
            icon={History}
            label="History"
            title="Check history"
            active={view === "history"}
            onClick={() => setView("history")}
            disabled={loading}
          />
          <NavItem
            icon={LayoutGrid}
            label="Stats"
            title="Your statistics"
            active={view === "stats"}
            onClick={() => setView("stats")}
            disabled={loading}
          />
          <NavItem
            icon={Globe2}
            label="Sources"
            title="Verification network"
            active={dialog === "mesh"}
            onClick={() => setDialog("mesh")}
          />
          <NavItem
            icon={SettingsIcon}
            label="Settings"
            title="Settings"
            active={view === "settings"}
            onClick={() => setView("settings")}
            disabled={loading}
          />
        </nav>
        <div className="rail-bottom">
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavItem
            icon={Command}
            label="Commands"
            title="Open commands"
            active={commands !== null}
            onClick={() => setCommands("commands")}
          />
          <NavItem
            icon={Terminal}
            label="Status"
            title="Service diagnostics"
            active={dialog === "dev"}
            onClick={() => setDialog("dev")}
          />
          <NavItem
            icon={Lock}
            label="Privacy"
            title="Privacy and security"
            active={dialog === "lock"}
            onClick={() => setDialog("lock")}
          />
        </div>
        <div className="rail-live">
          <span className={`status-dot ${ready ? "good" : "idle"}`} />
          <span>API</span>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-brand">
            <div className="core-label">
              <i />
              ClaimLens
            </div>
            <div className="guard-label">
              <strong>FACT CHECKING</strong>
              <i />
              <span className={`status-dot ${ready ? "good" : "idle"}`} />
              <span role="status">{status}</span>
            </div>
          </div>
          <div className="neural-path">
            <span>VERIFICATION FLOW</span>
            <div>
              CLAIM <ArrowRight size={11} /> EVIDENCE <ArrowRight size={11} />
              <strong>{loading ? "CHECKING" : "FINDING"}</strong>
            </div>
          </div>
          <div className="header-right">
            <div className="connection-layer">
              <span>CONNECTION_LAYER</span>
              <strong>
                <span className="status-dot good" />
                {window.location.protocol === "https:" ? "HTTPS_ACTIVE" : "LOCAL_PREVIEW"}
              </strong>
            </div>
            <div className="local-time">
              <strong>
                {clock.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </strong>
              <span>LOCAL_TIME</span>
            </div>
            <button
              className="header-orb"
              onClick={() => setDialog("dev")}
              aria-label="Open service status"
            >
              <i />
            </button>
          </div>
        </header>
        <div className="dashboard-body">
          <main id="main" ref={mainRef} tabIndex={-1} className="investigation-content">
            {view === "check" ? (
              <>
                {!shared && (
                  <section className="scan-search" aria-label="Check a claim or article">
                    <div className="scan-heading">
                      <label htmlFor="main-search">{t("verifyPrompt")}</label>
                      <span className="input-mode">{isArticle ? "Article" : "Claim"}</span>
                    </div>
                    <form className="scan-form" onSubmit={submit}>
                      <Search size={20} />
                      <textarea
                        id="main-search"
                        ref={fieldRef}
                        aria-label="Claim or article URL"
                        value={claim}
                        onChange={(e) => setClaim(e.target.value)}
                        placeholder="Paste a claim or article URL…"
                        rows={isArticle ? 1 : 2}
                        minLength={8}
                        maxLength={isArticle ? 2048 : 2000}
                        required
                        disabled={loading}
                        aria-describedby="scan-help scan-count"
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                      <button
                        className="execute-button"
                        type="submit"
                        disabled={
                          loading ||
                          health.status === "setup_required" ||
                          claim.trim().length < 8 ||
                          (isArticle &&
                            preparedArticle &&
                            articleClaims.length > 0 &&
                            !selectedClaims.length)
                        }
                      >
                        {loading ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        <span>
                          {loading
                            ? "Checking"
                            : isArticle && !preparedArticle
                              ? t("chooseClaims")
                              : t("check")}
                        </span>
                      </button>
                    </form>
                    <div className="scan-help-row">
                      <p className="scan-help" id="scan-help">
                        {isArticle
                          ? "We check up to three key claims from this article."
                          : "Be specific about names, dates, and numbers."}
                      </p>
                      <div className="scan-input-meta">
                        <span
                          id="scan-count"
                          className={`scan-count ${claim.length >= (isArticle ? 2048 : 2000) - 100 ? "near-limit" : ""}`}
                        >
                          {claim.length.toLocaleString()} /{" "}
                          {(isArticle ? 2048 : 2000).toLocaleString()}
                        </span>
                        <kbd className="search-shortcut" title="Focus the claim field">
                          Ctrl / ⌘ K
                        </kbd>
                      </div>
                    </div>
                    {articleClaims.length > 0 && preparedArticle && (
                      <fieldset className="article-choices">
                        <legend>{t("chooseClaims")}</legend>
                        <p>{t("chooseInstruction")}</p>
                        {articleClaims.map((value) => (
                          <label key={value}>
                            <input
                              type="checkbox"
                              checked={selectedClaims.includes(value)}
                              disabled={loading}
                              onChange={(event) =>
                                setSelectedClaims(
                                  event.target.checked
                                    ? [...selectedClaims, value]
                                    : selectedClaims.filter((item) => item !== value),
                                )
                              }
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {health.test_mode && (
                      <p className="test-preview-note">
                        TEST_PREVIEW · Controlled provider responses. Results in this preview are
                        simulated, not live fact checks.
                      </p>
                    )}
                    {health.status === "setup_required" && (
                      <div className="error-banner" role="status">
                        <CircleAlert size={18} />
                        <div>
                          <strong>The service needs configuration</strong>
                          <p>Configure the server’s Gemini and Tavily API keys to run checks.</p>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div className="error-banner" role="alert">
                        <CircleAlert size={18} />
                        <div>
                          <strong>This check wasn’t completed</strong>
                          <p>{error}</p>
                        </div>
                      </div>
                    )}
                    {notice && (
                      <p className="notice" role="status">
                        {notice}
                      </p>
                    )}
                  </section>
                )}
                {shared && notice && (
                  <p className="notice" role="status">
                    {notice}
                  </p>
                )}
                {shared && error && (
                  <p className="error-banner" role="alert">
                    {error}
                  </p>
                )}
                <section className="investigations" aria-label="Fact-check findings">
                  <div className="section-label">
                    <h2>
                      {loading ? "CHECK_IN_PROGRESS" : result ? "LATEST_FINDING" : "YOUR_WORKSPACE"}
                    </h2>
                    <span>{result ? "Evidence & sources" : "AI-assisted verification"}</span>
                  </div>
                  {loading ? (
                    <div className="scan-loading" role="status" aria-live="polite">
                      <LoaderCircle size={44} className="spin" />
                      <h2>Following the evidence</h2>
                      <p>{progress?.detail || "Waiting for verification to start."}</p>
                      <ol className="pipeline-stages">
                        {(
                          [
                            "normalizing",
                            "extracting",
                            "queries",
                            "searching",
                            "reading",
                            "analyzing",
                            "validating",
                          ] as const
                        ).map((stage) => (
                          <li
                            key={stage}
                            className={progress?.stage === stage ? "current" : ""}
                            aria-current={progress?.stage === stage ? "step" : undefined}
                          >
                            {stage}
                          </li>
                        ))}
                      </ol>
                      <span>{elapsed}s elapsed · Complex checks can take about a minute.</span>
                      <button
                        className="secondary-button"
                        onClick={() => controller.current?.abort()}
                      >
                        <X size={15} />
                        {t("cancel")}
                      </button>
                    </div>
                  ) : result ? (
                    <div className="result-anchor" ref={resultRef}>
                      <Suspense fallback={<p role="status">Loading finding…</p>}>
                        <Result
                          result={result}
                          key={result.id}
                          onRecheck={onRecheck}
                          onShare={onShare}
                          allowShare={Boolean(health.persistence)}
                          shared={shared}
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <Standby ready={ready} latency={latest?.latency_ms} onExample={useExample} />
                  )}
                </section>
              </>
            ) : view === "history" ? (
              <section className="archive-view">
                <div className="section-label">
                  <h1>ARCHIVE_RECORDS</h1>
                  <span>COUNT: {history.length}</span>
                </div>
                <p className="view-description">Up to 50 checks saved in this browser.</p>
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
                  <button
                    className="text-button"
                    disabled={!history.length}
                    onClick={() => downloadJson(history, "claimlens-history.json")}
                  >
                    <Download size={16} />
                    {t("exportJson")}
                  </button>
                  <button
                    className="text-button"
                    disabled={!history.length}
                    onClick={() => downloadCsv(history)}
                  >
                    <Download size={16} />
                    {t("exportCsv")}
                  </button>
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
                      {history.length ? "No matching checks" : "Your first finding starts here"}
                    </h2>
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
                      <button className="secondary-button" onClick={() => setView("check")}>
                        Start a scan
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="history-list">
                    {filtered.map((row) => (
                      <article className="history-row" key={row.id}>
                        <button className="history-open" onClick={() => openResult(row)}>
                          <div>
                            <VerdictBadge verdict={row.verdict} />
                            <span className="history-date">
                              {new Date(row.checked_at).toLocaleString()}
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
            ) : view === "settings" ? (
              <Settings health={health} />
            ) : (
              <Stats history={history} />
            )}
          </main>
          <aside className="telemetry-sidebar" aria-label="Service telemetry">
            <section>
              <div className="section-label">
                <h2>SERVICE_STATUS</h2>
                <span className={`status-dot ${ready ? "good" : "idle"}`} />
              </div>
              <div className="telemetry-rows">
                <StatusRow
                  label="Evidence search"
                  value={health.configured?.evidence ? "CONFIGURED" : "WAITING"}
                  state={health.configured?.evidence ? "good" : "idle"}
                />
                <StatusRow
                  label="AI analysis"
                  value={health.configured?.analysis ? "CONFIGURED" : "WAITING"}
                  state={health.configured?.analysis ? "good" : "idle"}
                />
                <StatusRow
                  label="Current check"
                  value={loading ? `${elapsed}s` : "IDLE"}
                  state={loading ? "blue" : "idle"}
                />
                <StatusRow label="History storage" value="LOCAL" state="idle" />
              </div>
              <p className="telemetry-note">
                Configured providers may still be busy or unavailable.
              </p>
            </section>
            <section className="resource-section">
              <div className="section-label">
                <h2>
                  <Activity size={13} className="blue" />
                  YOUR_ACTIVITY
                </h2>
              </div>
              <div className="resource-card">
                <span>LAST CHECK TIME</span>
                <div>
                  <strong>{latest ? `${(latest.latency_ms / 1000).toFixed(1)}s` : "—"}</strong>
                </div>
                <p className="resource-caption">Time taken by your most recent check.</p>
              </div>
              <div className="resource-card amber">
                <span>LOCAL_ARCHIVE_CAPACITY</span>
                <Zap size={32} className="resource-icon" />
                <div>
                  <strong>
                    {history.length}
                    <small> / 50</small>
                  </strong>
                  <div className="quota-blocks" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <i key={i} className={i < Math.ceil(history.length / 5) ? "filled" : ""} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <section className="security-card">
              <Shield size={48} className="security-watermark" />
              <h2>
                <span className="status-dot blue" />
                YOUR_DATA
              </h2>
              <p>
                Your claim is sent to the verification providers. Saved findings stay in{" "}
                <strong>this browser</strong>.
              </p>
              <div className="security-tags">
                <span>LOCAL HISTORY</span>
                <span>SERVER-SIDE KEYS</span>
              </div>
              <button className="text-button" onClick={() => setDialog("lock")}>
                Privacy details
                <ArrowUpRight size={14} />
              </button>
            </section>
          </aside>
        </div>
        <footer className="system-footer">
          <div>
            <span>API</span>
            <strong className={ready ? "green" : "amber"}>{status}</strong>
          </div>
          <div>
            <span>CHECK</span>
            <strong className="blue">{loading ? "RUNNING" : "IDLE"}</strong>
          </div>
          <div className="footer-history">
            <span>HISTORY</span>
            <strong>THIS BROWSER</strong>
          </div>
          <p>ClaimLens · Evidence before certainty</p>
        </footer>
      </div>
      {dialog && (
        <InfoDialog key={dialog} kind={dialog} health={health} onClose={() => setDialog(null)} />
      )}
      {commands && (
        <Commands onClose={() => setCommands(null)} onView={setView} help={commands === "help"} />
      )}
    </div>
  );
}
