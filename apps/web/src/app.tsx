import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FormEvent,
  type SetStateAction,
} from "react";
import {
  HealthSchema,
  ExtractionSchema,
  ResultSchema,
  type Result,
  type Health,
  type ProgressEvent,
  type Verdict,
  type CheckInput,
} from "@verity/shared";
import { apiRequest, streamCheck } from "./api.ts";
import { readHistory, saveHistory, importHistory } from "./storage.ts";
import Dashboard from "./dashboard";
import { ToastStack } from "./components/ui";
import { useToasts } from "./hooks";
import type { View } from "./types";
function incomingClaim(): string {
  try {
    return new URLSearchParams(window.location.hash.slice(1)).get("claim")?.slice(0, 2000) || "";
  } catch {
    return "";
  }
}
export default function App() {
  const { items: toasts, notify, dismiss } = useToasts();
  const [view, setView] = useState<View>("check"),
    [claim, updateClaim] = useState(incomingClaim),
    [history, setHistory] = useState<Result[]>(readHistory),
    [result, setResult] = useState<Result | null>(null);
  const [health, setHealth] = useState<Health>({ status: "checking" }),
    [loading, setLoading] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState(""),
    [verdictFilter, setVerdictFilter] = useState<Verdict | "ALL">("ALL"),
    [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [articleClaims, setArticleClaims] = useState<string[]>([]),
    [selectedClaims, setSelectedClaims] = useState<string[]>([]),
    [preparedUrl, setPreparedUrl] = useState("");
  const controller = useRef<AbortController | null>(null),
    checking = useRef(false),
    historyRef = useRef(history);
  const resultRef = useRef<HTMLDivElement | null>(null),
    fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const mode = /^https?:\/\//i.test(claim.trim()) ? "article" : "claim",
    shared = window.location.pathname.startsWith("/shared/");
  const setClaim = useCallback((value: SetStateAction<string>) => {
    updateClaim(value);
    setArticleClaims([]);
    setSelectedClaims([]);
    setPreparedUrl("");
  }, []);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    let alive = true;
    const abort = new AbortController();
    const checkHealth = async () => {
      try {
        const data = await apiRequest("v1/health", { signal: abort.signal }, HealthSchema);
        if (alive) setHealth(data);
      } catch {
        if (alive) setHealth({ status: "unreachable" });
      }
    };
    void checkHealth();
    const interval = setInterval(() => {
      void checkHealth();
    }, 60000);
    const changed = (event: StorageEvent) => {
      if (
        event.key === null ||
        ["verity-checks-v1", "claimlens-checks-v1", "cuda-ai-checks-v3"].includes(event.key)
      )
        setHistory(readHistory());
    };
    window.addEventListener("storage", changed);
    if (window.location.hash.startsWith("#claim="))
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (shared) {
      const token = window.location.pathname.split("/")[2];
      void apiRequest(
        `v1/shared/${encodeURIComponent(token || "")}`,
        { signal: abort.signal },
        ResultSchema,
      )
        .then((data) => {
          if (alive) {
            setResult(data);
            setNotice("Shared read-only finding. It is not automatically saved to your history.");
          }
        })
        .catch((failure) => {
          if (alive)
            setError(
              failure instanceof Error ? failure.message : "This shared finding is unavailable.",
            );
        });
    }
    return () => {
      alive = false;
      abort.abort();
      clearInterval(interval);
      window.removeEventListener("storage", changed);
    };
  }, [shared]);
  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [loading]);
  useEffect(() => () => controller.current?.abort(), []);
  function persist(next: Result[], message = "Finding saved on this device") {
    historyRef.current = next;
    setHistory(next);
    if (!saveHistory(next)) {
      setNotice("Browser storage is unavailable or full. Download your report to keep a copy.");
      notify("Could not save locally. Download a copy instead.", "error");
    } else notify(message);
  }
  async function execute(input: CheckInput) {
    if (checking.current) return;
    checking.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setElapsed(0);
    setError("");
    setNotice("");
    setProgress(null);
    setResult(null);
    try {
      const data = await streamCheck(input, setProgress, abort.signal);
      setResult(data);
      persist([data, ...historyRef.current.filter((row) => row.id !== data.id)].slice(0, 50));
      if (data.permalink) {
        const url = new URL(data.permalink, window.location.origin).href;
        try {
          await navigator.clipboard.writeText(url);
          setNotice("Read-only link copied. Anyone with this link can read the shared finding.");
        } catch {
          setNotice(`Read-only link: ${url}`);
        }
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "This check was not completed.";
      if (abort.signal.aborted) setNotice(message);
      else setError(message);
    } finally {
      checking.current = false;
      setLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checking.current) return;
    if (
      mode === "article" &&
      preparedUrl === claim.trim() &&
      articleClaims.length &&
      !selectedClaims.length
    ) {
      setNotice("Select at least one extracted claim to verify.");
      return;
    }
    if (mode === "article" && preparedUrl !== claim.trim()) {
      checking.current = true;
      const abort = new AbortController();
      controller.current = abort;
      setLoading(true);
      setElapsed(0);
      setError("");
      setNotice("");
      setProgress({
        stage: "extracting",
        detail: "Reading the article and extracting claims",
        elapsed_ms: 0,
      });
      try {
        const data = await apiRequest(
          "v1/articles/claims",
          { method: "POST", body: JSON.stringify({ pageUrl: claim.trim() }), signal: abort.signal },
          ExtractionSchema,
        );
        setArticleClaims(data.claims);
        setSelectedClaims(data.claims);
        setPreparedUrl(claim.trim());
        if (data.claims.length) {
          setNotice("Choose the extracted claims you want to verify, then select Check.");
          return;
        }
      } catch (failure) {
        const message =
          failure instanceof Error ? failure.message : "The article could not be read.";
        if (abort.signal.aborted) setNotice(message);
        else setError(message);
        return;
      } finally {
        checking.current = false;
        setLoading(false);
      }
    }
    const input: CheckInput =
      mode === "claim"
        ? { text: claim.trim() }
        : {
            pageUrl: claim.trim(),
            ...(selectedClaims.length ? { selectedClaims } : {}),
          };
    await execute(input);
  }
  function openResult(row: Result) {
    setError("");
    setNotice("");
    setResult(row);
    setView("check");
    setClaim(row.input);
  }
  function onRecheck() {
    if (!result) return;
    void execute(
      result.input_type === "claim"
        ? { text: result.input, recheck: true }
        : { pageUrl: result.input, recheck: true },
    );
  }
  async function onShare() {
    if (!result) return;
    await execute(
      result.input_type === "claim"
        ? { text: result.input, persist: true }
        : { pageUrl: result.input, persist: true },
    );
  }
  async function onImport(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error("Import a file smaller than 2 MB.");
      const imported = importHistory(
        await file.text(),
        file.name.toLowerCase().endsWith(".csv") ? "csv" : "json",
      );
      persist(
        [
          ...imported,
          ...historyRef.current.filter((row) => !imported.some((item) => item.id === row.id)),
        ].slice(0, 50),
        `Imported ${imported.length} ${imported.length === 1 ? "finding" : "findings"}`,
      );
      setNotice("");
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : "This file could not be imported.";
      setNotice(message);
      notify(message, "error");
    }
  }
  const filtered = history.filter(
    (row) =>
      (verdictFilter === "ALL" || row.verdict === verdictFilter) &&
      [row.input, ...row.claims.map((item) => item.claim)]
        .join(" ")
        .toLowerCase()
        .includes(filter.trim().toLowerCase()),
  );
  return (
    <>
      <Dashboard
        {...{
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
          preparedArticle: preparedUrl === claim.trim(),
          onImport,
          onRecheck,
          onShare,
          shared,
        }}
      />
      <ToastStack items={toasts} dismiss={dismiss} />
    </>
  );
}
