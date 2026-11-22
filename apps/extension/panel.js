const $ = (id) => document.getElementById(id);
let image = null;
let busy = false;
let apiUrl = "http://localhost:8080";
let panelWindowId;
const labels = {
  TRUE: "Supported",
  FALSE: "Refuted",
  MIXED: "Mixed findings",
  UNVERIFIED: "Unverified",
};
async function message(type, data = {}) {
  if (["capture", "capture-region", "selection"].includes(type)) {
    const current = await chrome.windows.getCurrent();
    panelWindowId = current.id;
  }
  const reply = await chrome.runtime.sendMessage({ type, ...data, windowId: panelWindowId });
  if (!reply?.ok)
    throw new Error(reply?.error || "The extension did not respond. Reopen its panel.");
  return reply.data;
}
function error(value = "") {
  $("error").textContent = value;
  $("error").hidden = !value;
}
function updateButtons() {
  for (const id of ["capture", "selection", "verify", "discard"]) $(id).disabled = busy;
  for (const button of $("choices").querySelectorAll("button")) button.disabled = busy;
  for (const id of ["capture", "selection"]) $(id).setAttribute("aria-busy", String(busy));
  $("claim").disabled = busy;
}
async function run(text, action) {
  if (busy) return;
  busy = true;
  updateButtons();
  error();
  $("status").textContent = text;
  $("result").hidden = true;
  try {
    await action();
    $("status").textContent = "";
  } catch (failure) {
    error(failure.message);
    $("status").textContent = "";
  } finally {
    busy = false;
    updateButtons();
    void consumeSelectedText().catch((failure) => error(failure.message));
  }
}
async function request(route, body) {
  let response;
  try {
    response = await fetch(`${apiUrl}/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(110000),
    });
  } catch (failure) {
    throw new Error(
      failure.name === "TimeoutError"
        ? "This check timed out. Please try again."
        : "Cannot reach the fact-checking service. Keep the local backend running, then try again.",
      { cause: failure },
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("The connected service did not return the Verity API.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The check could not be completed.");
  return data;
}
function setClaim(text) {
  $("claim").value = text;
  $("count").textContent = `${text.length} / 2000`;
}
$("claim").addEventListener(
  "input",
  () => ($("count").textContent = `${$("claim").value.length} / 2000`),
);
$("capture").addEventListener("click", () =>
  run("Drag over a claim on the page. Release to search.", async () => {
    const data = await message("capture-region");
    if (data.cancelled) return;
    const visibleText = typeof data.text === "string" ? data.text.trim().slice(0, 2000) : "";
    if (visibleText) setClaim(visibleText);
    image = data.image || null;
    if (image) $("screenshot").src = image;
    else $("screenshot").removeAttribute("src");
    $("preview").hidden = !image;
    $("choices").replaceChildren();
    $("result").hidden = true;
    $("status").textContent = "Reading the selected area…";
    let extracted;
    if (image) {
      try {
        extracted = await request("extract-screen", { image });
      } catch (failure) {
        if (visibleText.length < 8) throw failure;
        extracted = { claims: [visibleText] };
      }
    } else extracted = { claims: visibleText ? [visibleText] : [] };
    const claims = Array.isArray(extracted.claims)
      ? [
          ...new Set(
            extracted.claims.filter(
              (claim) =>
                typeof claim === "string" && claim.trim().length >= 8 && claim.length <= 2000,
            ),
          ),
        ].slice(0, 3)
      : [];
    if (!claims.length && visibleText.length >= 8) claims.push(visibleText);
    if (!claims.length)
      throw new Error("No legible factual claim was found. Select a clearer area and try again.");
    setClaim(claims[0]);
    if (claims.length > 1) {
      $("choices").append(
        element("p", "Found several claims. Checking the first; select another to check it."),
      );
      for (const claim of claims) {
        const button = element("button", claim);
        button.addEventListener("click", () => {
          setClaim(claim);
          run("Finding evidence and checking the claim…", () => verifyClaim(claim));
        });
        $("choices").append(button);
      }
    }
    $("status").textContent = "Finding evidence and checking the captured claim…";
    await verifyClaim(claims[0]);
  }),
);
$("discard").addEventListener("click", () => {
  image = null;
  $("screenshot").removeAttribute("src");
  $("preview").hidden = true;
});
$("selection").addEventListener("click", () =>
  run("Reading your selection…", async () => {
    const data = await message("selection");
    if (!data.text?.trim()) throw new Error("Select a claim on the page first, or paste it below.");
    setClaim(data.text.trim());
    $("status").textContent = "Finding evidence and checking the selected claim…";
    await verifyClaim(data.text.trim());
  }),
);
function element(tag, text, className) {
  const item = document.createElement(tag);
  item.textContent = text;
  if (className) item.className = className;
  return item;
}
function link(url, title) {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
      return element("span", title);
  } catch {
    return element("span", title);
  }
  const anchor = element("a", title);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}
function render(result) {
  if (!labels[result?.verdict] || !Array.isArray(result.claims))
    throw new Error("The API returned an incomplete result.");
  const root = $("result");
  root.replaceChildren();
  root.hidden = false;
  root.append(
    element("span", labels[result.verdict], `badge ${result.verdict}`),
    element("h2", result.input),
    element("p", result.summary),
  );
  if (result.demo) root.append(element("p", "Demo · These results are simulated.", "muted"));
  for (const warning of result.warnings || []) root.append(element("p", warning));
  for (const claim of result.claims) {
    if (result.claims.length > 1 || claim.claim !== result.input)
      root.append(element("h3", claim.claim));
    if (result.claims.length > 1 || claim.explanation !== result.summary)
      root.append(element("p", claim.explanation));
    for (const evidence of claim.evidence || []) {
      const source = claim.sources?.find((s) => s.id === evidence.source_id);
      if (!source) continue;
      const quote = element("blockquote", "");
      quote.append(
        element("p", `“${evidence.quote}”`),
        link(source.url, `${evidence.stance} · ${source.publisher}`),
      );
      root.append(quote);
    }
    const sources = element("ul", "");
    for (const source of claim.sources || []) {
      const item = element("li", "");
      item.append(link(source.url, `${source.title} · ${source.provider || "Tavily"}`));
      sources.append(item);
    }
    root.append(sources);
  }
  root.append(
    element(
      "p",
      `Checked ${new Date(result.checked_at).toLocaleString()} · ${(result.latency_ms / 1000).toFixed(1)}s`,
      "muted",
    ),
  );
}
$("check-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("claim").value.trim();
  if (text.length < 8 || text.length > 2000) {
    error("Use a claim between 8 and 2000 characters.");
    return;
  }
  $("result").hidden = true;
  run("Finding evidence and checking the claim…", () => verifyClaim(text));
});
async function verifyClaim(text) {
  if (text.length < 8 || text.length > 2000)
    throw new Error("Use a claim between 8 and 2000 characters.");
  const result = await request("analyze-claim", { text });
  render(result);
  try {
    const { history = [] } = await chrome.storage.local.get("history");
    await chrome.storage.local.set({
      history: [result, ...(Array.isArray(history) ? history : [])].slice(0, 20),
    });
  } catch {
    error("The check completed, but this browser could not save it to history.");
  }
}
async function consumeSelectedText() {
  if (busy) return;
  const { selectedText, selectedWindowId } = await chrome.storage.session.get([
    "selectedText",
    "selectedWindowId",
  ]);
  if (!selectedText || busy) return;
  const current = await chrome.windows.getCurrent();
  if (selectedWindowId !== undefined && selectedWindowId !== current.id) return;
  await run("Finding evidence and checking the selected claim…", async () => {
    await chrome.storage.session.remove(["selectedText", "selectedWindowId"]);
    const text = selectedText.trim();
    setClaim(text);
    await verifyClaim(text);
  });
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.apiUrl) {
    apiUrl = changes.apiUrl.newValue;
  }
  if (area === "session" && changes.selectedText) {
    void consumeSelectedText().catch((failure) => error(failure.message));
  }
});
(async () => {
  try {
    const data = await message("get-status");
    apiUrl = data.apiUrl;
    updateButtons();
    const { history = [] } = await chrome.storage.local.get("history");
    if (history[0]) render(history[0]);
    await consumeSelectedText();
  } catch (failure) {
    error(failure.message);
  }
})();
