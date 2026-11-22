import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  History,
  LayoutGrid,
  LoaderCircle,
  Search,
  Settings as SettingsIcon,
  X,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { Health, Result as CheckResult } from "@verity/shared";
import { APP_VERSION } from "@verity/shared";
import { evidenceProviders, labels, type DashboardProps } from "./types";
import Settings from "./settings";
import HistoryView from "./components/history-view";
import InsightsView from "./components/insights-view";
import { ProgressSkeleton, VerdictBadge } from "./components/ui";
import { useAppearance, useModalDialog } from "./hooks";
import Commands from "./components/commands";
import { t } from "./messages";
const Result = lazy(() => import("./result.tsx"));

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
      <Icon size={19} />
      <span>{label}</span>
      {active && <i className="nav-active-dot" />}
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
      <span>{label}</span>
      <strong className={`status-tag ${state}`}>
        <i className={`status-dot ${state}`} />
        {value}
      </strong>
    </div>
  );
}
function InfoDialog({ health, onClose }: { health: Health; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useModalDialog(ref);
  return (
    <dialog
      ref={ref}
      className="system-dialog info-slideover"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">Service & evidence</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      <StatusRow
        label="Service"
        value={health.status === "ready" ? "Ready" : health.status.replaceAll("_", " ")}
        state={health.status === "ready" ? "good" : "idle"}
      />
      <StatusRow label="Version" value={health.version || "Unknown"} state="idle" />
      <StatusRow
        label="Mode"
        value={health.test_mode ? "Demo fixtures" : "Live"}
        state={health.test_mode ? "idle" : "good"}
      />
      <h3 className="service-section-title">Evidence providers</h3>
      <p>Search providers retrieve sources. Gemini compares their evidence with your claim.</p>
      {evidenceProviders(health).map((provider) => (
        <StatusRow
          key={provider.name}
          label={provider.name}
          value={provider.enabled ? "Enabled" : provider.missing}
          state={provider.enabled ? "good" : "idle"}
        />
      ))}
      <StatusRow
        label="Analysis · Gemini"
        value={health.configured?.analysis ? "Configured" : "Unavailable"}
        state={health.configured?.analysis ? "good" : "idle"}
      />
      <p className="dialog-note">
        {health.test_mode
          ? "This preview uses simulated results."
          : "Provider availability and quota may vary."}
      </p>
    </dialog>
  );
}
function Standby({
  history,
  openResult,
  showHistory,
}: {
  history: CheckResult[];
  openResult: (result: CheckResult) => void;
  showHistory: () => void;
}) {
  return (
    <div className={`standby-panel ${history.length ? "" : "empty-standby"}`}>
      {history.length ? (
        <section className="workbench-recent">
          <div className="section-title">
            <h3>Recent findings</h3>
            <button className="text-button" onClick={showHistory}>
              All history
              <ArrowRight size={14} />
            </button>
          </div>
          {history.slice(0, 3).map((row) => (
            <button className="recent-check" key={row.id} onClick={() => openResult(row)}>
              <span className="recent-copy">
                <strong>{row.input}</strong>
                <small>
                  {new Date(row.checked_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </span>
              <VerdictBadge verdict={row.verdict} />
              <ArrowUpRight size={16} />
            </button>
          ))}
        </section>
      ) : (
        <div className="check-guide" aria-label="How to use Verity">
          <ol>
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <strong>Start with a claim</strong>
                <p>Enter a factual statement or an article URL.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <strong>Review the finding</strong>
                <p>See what is supported, refuted, or still uncertain.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <strong>Read the sources</strong>
                <p>Follow the quoted evidence to the original pages.</p>
              </div>
            </li>
          </ol>
        </div>
      )}
    </div>
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
  const { appearance, setAppearance } = useAppearance();
  const [dialog, setDialog] = useState(false);
  const [commands, setCommands] = useState<"commands" | "help" | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [view]);
  const ready = health.status === "ready";
  const quotaError = /quota|usage limit|rate limit|too many|several checks/i.test(error);
  useEffect(() => {
    document.title = `${view === "check" ? (result ? labels[result.verdict].label : "Check a claim") : view === "history" ? "History" : view === "stats" ? "Activity" : "Settings"} — Verity`;
  }, [view, result]);
  const isArticle = /^https?:\/\//i.test(claim.trim());
  const checkShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ ↵" : "Ctrl ↵";
  const status = health.test_mode
    ? "Demo preview"
    : ready
      ? "Ready"
      : health.status === "checking"
        ? "Connecting"
        : health.status === "setup_required"
          ? "Setup needed"
          : "Offline";
  function selectExample(value: string) {
    setClaim(value);
    requestAnimationFrame(() => fieldRef.current?.focus());
  }
  useEffect(() => {
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
    return () => window.removeEventListener("keydown", shortcut);
  }, [setView, fieldRef]);
  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="ambient-light" aria-hidden="true" />{" "}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-inner">
            <button
              className="header-brand"
              aria-label="Verity home"
              onClick={() => setView("check")}
            >
              <img className="brand-logo" src="/verity-logo.png" alt="" width="36" height="36" />
              <span className="brand-name">
                Verity<span>.</span>
              </span>
            </button>
            <nav className="header-nav" aria-label="Main navigation">
              <NavItem
                icon={Search}
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
                label="Insights"
                title="Your statistics"
                active={view === "stats"}
                onClick={() => setView("stats")}
                disabled={loading}
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
            <div className="header-right">
              <button
                className="new-check"
                aria-label="New check"
                disabled={loading}
                onClick={() => {
                  setView("check");
                  setResult(null);
                  setClaim("");
                  requestAnimationFrame(() => fieldRef.current?.focus());
                }}
              >
                <Plus size={16} />
                <span>New check</span>
              </button>
              <button
                className={`service-pill ${health.test_mode ? "demo" : ready ? "ready" : "offline"}`}
                aria-label="Open service status"
                title="Service status and provider configuration"
                onClick={() => setDialog(true)}
              >
                <i className={`status-dot ${ready ? "good" : "idle"}`} />
                <span role="status">{status}</span>
              </button>
            </div>
          </div>
        </header>
        <div className="dashboard-body">
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            className={`investigation-content ${view === "check" ? "check-workspace" : ""} ${result || loading || shared ? "has-finding" : ""} ${shared ? "shared-view" : ""}`}
          >
            {view === "check" && !shared && (
              <div className="desk-intro">
                <h1>
                  The <em>evidence</em> desk
                </h1>
                <p className="desk-description">
                  Check a claim or article against independent sources.
                </p>
                {history.length > 0 && (
                  <button
                    className="saved-count"
                    title="Open saved check history"
                    onClick={() => setView("history")}
                    disabled={loading}
                  >
                    <History size={14} />
                    {history.length} saved
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
            {view === "check" ? (
              <>
                {!shared && (
                  <>
                    <section className="scan-search" aria-label="Check a claim or article">
                      <div className="scan-heading">
                        <label htmlFor="main-search">
                          <Search size={16} />
                          Claim or article URL
                        </label>
                        {isArticle && <span className="input-mode">Article</span>}
                      </div>
                      <form className="scan-form" onSubmit={submit}>
                        <textarea
                          id="main-search"
                          ref={fieldRef}
                          aria-label="Claim or article URL"
                          value={claim}
                          onChange={(e) => setClaim(e.target.value)}
                          placeholder="Enter a claim or paste an article link…"
                          rows={result || loading || isArticle ? 2 : 3}
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

                        <div className="composer-footer">
                          <div className="composer-hint">
                            <span id="scan-help">
                              {isArticle
                                ? "Choose which claims to review"
                                : claim.trim().length > 0 && claim.trim().length < 8
                                  ? "Enter at least 8 characters"
                                  : "Checks save to this browser"}
                            </span>
                            <span
                              id="scan-count"
                              className={`scan-count ${claim.length >= (isArticle ? 2048 : 2000) - 100 ? "near-limit" : ""}`}
                            >
                              {claim.length.toLocaleString()} /{" "}
                              {(isArticle ? 2048 : 2000).toLocaleString()}
                            </span>
                          </div>
                          <div className="composer-controls">
                            <button
                              className="execute-button"
                              aria-busy={loading}
                              aria-label={
                                loading
                                  ? "Checking"
                                  : isArticle && !preparedArticle
                                    ? t("chooseClaims")
                                    : t("check")
                              }
                              aria-keyshortcuts="Control+Enter Meta+Enter"
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
                              {loading ? <LoaderCircle size={16} className="spin" /> : null}
                              <span>
                                {loading
                                  ? "Checking"
                                  : isArticle && !preparedArticle
                                    ? t("chooseClaims")
                                    : t("check")}
                              </span>
                              {!loading && (
                                <kbd className="button-shortcut" aria-hidden="true">
                                  {checkShortcut}
                                </kbd>
                              )}
                              {!loading && <ArrowRight size={18} />}
                            </button>
                          </div>
                        </div>
                      </form>
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
                      {health.test_mode && !result && (
                        <p className="test-preview-note">Demo preview · Results are simulated.</p>
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
                        <div
                          className={`error-banner ${quotaError ? "quota-banner" : ""}`}
                          role="alert"
                        >
                          <CircleAlert size={18} />
                          <div>
                            <strong>
                              {quotaError
                                ? "You’ve reached a usage limit"
                                : "We couldn’t complete this check"}
                            </strong>
                            <p>{error}</p>
                            <button
                              className="secondary-button error-retry"
                              onClick={() => fieldRef.current?.form?.requestSubmit()}
                              disabled={loading}
                            >
                              Try again
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        </div>
                      )}
                      {notice && (
                        <p className="notice" role="status">
                          {notice}
                        </p>
                      )}
                    </section>
                  </>
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
                {!shared && !result && !loading && (
                  <section className="workbench-examples">
                    <h2>Try an example</h2>
                    <button
                      disabled={loading}
                      onClick={() =>
                        selectExample("WHO classified aspartame as a Group 1 carcinogen.")
                      }
                    >
                      WHO and aspartame
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      disabled={loading}
                      onClick={() =>
                        selectExample("Antibiotics shorten recovery from seasonal flu.")
                      }
                    >
                      Antibiotics and seasonal flu
                      <ArrowUpRight size={14} />
                    </button>
                  </section>
                )}{" "}
                <section className="investigations" aria-label="Fact-check findings">
                  {loading ? (
                    <ProgressSkeleton
                      progress={progress}
                      elapsed={elapsed}
                      onCancel={() => controller.current?.abort()}
                    />
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
                    <Standby
                      history={history}
                      openResult={openResult}
                      showHistory={() => setView("history")}
                    />
                  )}
                </section>
              </>
            ) : view === "history" ? (
              <HistoryView
                history={history}
                filtered={filtered}
                filter={filter}
                setFilter={setFilter}
                verdictFilter={verdictFilter}
                setVerdictFilter={setVerdictFilter}
                notice={notice}
                onImport={onImport}
                persist={persist}
                result={result}
                setResult={setResult}
                openResult={openResult}
                onStart={() => setView("check")}
              />
            ) : view === "settings" ? (
              <Settings
                health={health}
                appearance={appearance}
                onAppearanceChange={setAppearance}
              />
            ) : (
              <InsightsView history={history} onStart={() => setView("check")} />
            )}
            <footer className="app-footer">
              <span>Verity v{APP_VERSION}</span>
              <nav aria-label="Legal information">
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
                  Privacy
                </a>
                <a href="/terms.html" target="_blank" rel="noopener noreferrer">
                  Terms
                </a>
              </nav>
            </footer>
          </main>
        </div>
      </div>
      {dialog && <InfoDialog health={health} onClose={() => setDialog(false)} />}
      {commands && (
        <Commands
          help={commands === "help"}
          onClose={() => setCommands(null)}
          onView={(next) => {
            setView(next);
            setCommands(null);
          }}
        />
      )}
    </div>
  );
}
