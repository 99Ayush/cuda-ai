import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./api.js";
import { readHistory, saveHistory, validResult } from "./storage.js";
import Dashboard from "./Dashboard.jsx";

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
  const [claim, setClaim] = useState(incomingClaim);
  const mode = /^https?:\/\//i.test(claim.trim()) ? "article" : "claim";
  const url = claim;
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
  useEffect(() => {
    if (!result || view !== "check") return;
    const frame = requestAnimationFrame(() => {
      const heading = resultRef.current?.querySelector("#result-title");
      heading?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [result, view]);
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
    if (health.test_mode) {
      setError("This is a simulation preview. Open the live website to check real claims.");
      return;
    }
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
    } catch (failure) {
      if (controller.current.signal.aborted) setNotice(failure.message);
      else setError(failure.message);
    } finally {
      checking.current = false;
      setLoading(false);
    }
  }
  function openResult(row) {
    setError("");
    setNotice("");
    setResult(row);
    setView("check");
  }
  const filtered = history.filter((row) =>
    [row.input, ...row.claims.map((item) => item.claim)]
      .join(" ").toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <Dashboard
      {...{
        view, setView, claim, setClaim, history, result, health, loading,
        elapsed, error, notice, filter, setFilter, filtered, controller,
        resultRef, fieldRef, submit, openResult, persist, setResult,
      }}
    />
  );
}
