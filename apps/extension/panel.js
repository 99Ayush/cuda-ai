const $ = (id) => document.getElementById(id);
let image = null;
let busy = false;
let apiUrl = "http://localhost:8080";
let enabled = true;
const labels = {
  TRUE: "Supported",
  FALSE: "Refuted",
  MIXED: "Mixed findings",
  UNVERIFIED: "Unverified",
};
async function message(type, data = {}) {
  const reply = await chrome.runtime.sendMessage({ type, ...data });
  if (!reply?.ok)
    throw new Error(reply?.error || "The extension did not respond. Reopen its panel.");
  return reply.data;
}
function error(value = "") {
  $("error").textContent = value;
  $("error").hidden = !value;
}
function updateButtons() {
  for (const id of ["capture", "selection", "read", "verify"]) $(id).disabled = busy || !enabled;
  $("claim").disabled = busy;
  $("api-url").disabled = busy;
  $("enabled").disabled = busy;
  $("discard").disabled = busy;
}
async function run(text, action) {
  if (busy) return;
  busy = true;
  updateButtons();
  error();
  $("status").textContent = text;
  try {
    await action();
    $("status").textContent = "";
  } catch (failure) {
    error(failure.message);
    $("status").textContent = "";
  } finally {
    busy = false;
    updateButtons();
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
        : "Cannot reach the fact-checking service. Check the URL in Settings and keep the local backend running.",
      { cause: failure },
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("This URL did not return the ClaimLens API. Check Settings.");
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
  run("Capturing the visible web page…", async () => {
    const data = await message("capture");
    image = data.image;
    $("screenshot").src = image;
    $("preview").hidden = false;
    $("choices").replaceChildren();
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
    setClaim(data.text);
  }),
);
$("read").addEventListener("click", () =>
  run("Reading visible claims with Gemini…", async () => {
    if (!image) throw new Error("Capture a screen first.");
    const data = await request("extract-screen", { image });
    if (!Array.isArray(data.claims) || !data.claims.length)
      throw new Error("No legible factual claim was found. Capture clearer text or paste a claim.");
    $("choices").replaceChildren();
    for (const claim of data.claims) {
      const button = document.createElement("button");
      button.textContent = claim;
      button.addEventListener("click", () => setClaim(claim));
      $("choices").append(button);
    }
    setClaim(data.claims[0]);
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
  for (const warning of result.warnings || []) root.append(element("p", warning));
  for (const claim of result.claims) {
    root.append(element("h3", claim.claim), element("p", claim.explanation));
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
  if (!enabled) return;
  const text = $("claim").value.trim();
  if (text.length < 8 || text.length > 2000) {
    error("Use a claim between 8 and 2000 characters.");
    return;
  }
  $("result").hidden = true;
  run("Finding evidence and checking the claim…", async () => {
    const result = await request("analyze-claim", { text });
    render(result);
    const { history = [] } = await chrome.storage.local.get("history");
    await chrome.storage.local.set({ history: [result, ...history].slice(0, 20) });
  });
});
$("enabled").addEventListener("change", async () => {
  try {
    const data = await message("set-enabled", { enabled: $("enabled").checked });
    enabled = data.enabled;
    updateButtons();
  } catch (failure) {
    $("enabled").checked = enabled;
    error(failure.message);
  }
});
$("api-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  try {
    const url = new URL($("api-url").value.trim());
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    )
      throw new Error(
        "Use an HTTPS service origin or localhost URL, without a path or credentials.",
      );
    const origins = [`${url.origin}/*`];
    if (
      !(await chrome.permissions.contains({ origins })) &&
      !(await chrome.permissions.request({ origins }))
    )
      throw new Error("Access was not granted. The connection was not changed.");
    const data = await message("connect", { apiUrl: url.origin });
    apiUrl = data.apiUrl;
    error();
    $("status").textContent = "Connection saved.";
  } catch (failure) {
    error(failure.message);
  }
});
$("clear-history").addEventListener("click", async () => {
  await chrome.storage.local.remove("history");
  $("result").hidden = true;
  $("result").replaceChildren();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    enabled = changes.enabled.newValue !== false;
    $("enabled").checked = enabled;
    updateButtons();
  }
  if (area === "local" && changes.apiUrl) {
    apiUrl = changes.apiUrl.newValue;
    $("api-url").value = apiUrl;
  }
  if (area === "session" && changes.selectedText) {
    setClaim(changes.selectedText.newValue || "");
    chrome.storage.session.remove("selectedText");
  }
});
(async () => {
  try {
    const data = await message("get-status");
    enabled = data.enabled;
    apiUrl = data.apiUrl;
    $("enabled").checked = enabled;
    $("api-url").value = apiUrl;
    updateButtons();
    const { history = [] } = await chrome.storage.local.get("history");
    if (history[0]) render(history[0]);
    const { selectedText } = await chrome.storage.session.get("selectedText");
    if (selectedText) {
      setClaim(selectedText);
      await chrome.storage.session.remove("selectedText");
    }
  } catch (failure) {
    error(failure.message);
  }
})();
