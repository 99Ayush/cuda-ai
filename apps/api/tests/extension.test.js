const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "../../..");
const extDir = path.join(root, "apps/extension");
const panelHtml = fs.readFileSync(path.join(extDir, "panel.html"), "utf8");
const panelSource = fs.readFileSync(path.join(extDir, "panel.js"), "utf8");
const bridgeSource = fs.readFileSync(path.join(extDir, "bridge.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(extDir, "background.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const tick = () => new Promise((resolve) => setImmediate(resolve));

function storageArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => key in data).map((key) => [key, data[key]]));
    },
    set: async (values) => void Object.assign(data, values),
    remove: async (key) => void delete data[key],
  };
}

function panelChrome(options = {}) {
  const local = storageArea(options.local || {});
  const session = storageArea(options.session || {});
  const changes = [];
  const sent = [];
  const localData = {
    enabled: options.enabled !== false,
    apiUrl: options.apiUrl || "http://localhost:8080",
    version: "3.0.0",
  };
  return {
    local,
    session,
    changes,
    sent,
    runtime: {
      id: "claimlensextensionid00000000000000",
      getManifest: () => ({ version: manifest.version }),
      sendMessage: async (message) => {
        sent.push(message);
        if (options.sendMessage) return options.sendMessage(message);
        if (message.type === "get-status") return { ok: true, data: localData };
        if (message.type === "set-enabled") {
          localData.enabled = message.enabled;
          return { ok: true, data: localData };
        }
        if (message.type === "connect") {
          localData.apiUrl = message.apiUrl;
          return { ok: true, data: localData };
        }
        return { ok: true, data: {} };
      },
    },
    storage: {
      local,
      session,
      onChanged: {
        addListener: (listener) => changes.push(listener),
      },
    },
    permissions: {
      contains: async () => options.permissionHeld !== false,
      request: async () => options.permissionGranted !== false,
    },
  };
}

async function loadPanel(
  chrome,
  fetchImpl = async () => {
    throw new Error("unexpected fetch");
  },
) {
  const dom = new JSDOM(panelHtml, {
    url: "chrome-extension://claimlensextensionid00000000000000/panel.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.chrome = chrome;
  dom.window.fetch = fetchImpl;
  dom.window.AbortSignal.timeout = () => new dom.window.AbortController().signal;
  dom.window.eval(panelSource);
  for (let i = 0; i < 8; i++) await tick();
  return dom;
}

function fire(dom, element, type = "click") {
  element.dispatchEvent(new dom.window.Event(type, { bubbles: true, cancelable: true }));
}

function jsonResponse(body, ok = true) {
  return {
    ok,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

function fixtureResult() {
  return {
    id: "check-1",
    input: "Lightning often strikes the same place repeatedly.",
    verdict: "TRUE",
    summary: "Fixture summary",
    claims: [
      {
        claim: "Lightning can strike twice.",
        explanation: "Fixture explanation",
        evidence: [{ source_id: "s1", stance: "SUPPORTS", quote: "A quoted excerpt" }],
        sources: [
          { id: "s1", title: "Weather", publisher: "Agency", url: "https://example.org/a" },
        ],
      },
    ],
    checked_at: "2026-11-21T12:00:00.000Z",
    latency_ms: 1200,
  };
}

test("extension manifest is a valid MV3 package aligned with the release version", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, packageVersion);
  assert.equal(manifest.side_panel.default_path, "panel.html");
  assert.equal(manifest.background.service_worker, "background.js");
  for (const permission of ["activeTab", "scripting", "storage", "sidePanel", "contextMenus"])
    assert.ok(manifest.permissions.includes(permission), `missing ${permission}`);
  for (const file of ["panel.html", "panel.js", "background.js", "bridge.js", "panel.css"])
    assert.ok(fs.existsSync(path.join(extDir, file)), `missing ${file}`);
});

test("panel loads background status and disables controls when checking is paused", async () => {
  const chrome = panelChrome({ enabled: false });
  const dom = await loadPanel(chrome);
  const doc = dom.window.document;
  assert.equal(doc.getElementById("enabled").checked, false);
  assert.equal(doc.getElementById("api-url").value, "http://localhost:8080");
  assert.equal(doc.getElementById("capture").disabled, true);
  assert.equal(doc.getElementById("verify").disabled, true);
  dom.window.close();
});

test("panel rejects short claims before any API call", async () => {
  const chrome = panelChrome();
  const dom = await loadPanel(chrome, async () => {
    throw new Error("fetch must not be called");
  });
  const doc = dom.window.document;
  doc.getElementById("claim").value = "short";
  fire(dom, doc.getElementById("check-form"), "submit");
  for (let i = 0; i < 4; i++) await tick();
  assert.match(doc.getElementById("error").textContent, /between 8 and 2000/);
  assert.equal(doc.getElementById("error").hidden, false);
  dom.window.close();
});

test("panel verifies a claim, renders grounded evidence and stores a bounded history", async () => {
  const chrome = panelChrome({
    local: { history: Array.from({ length: 20 }, (_, i) => ({ id: `old-${i}` })) },
  });
  let called;
  const dom = await loadPanel(chrome, async (url, options) => {
    called = { url, body: JSON.parse(options.body) };
    return jsonResponse(fixtureResult());
  });
  const doc = dom.window.document;
  doc.getElementById("claim").value = "Lightning often strikes the same place repeatedly.";
  fire(dom, doc.getElementById("check-form"), "submit");
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(called.url, "http://localhost:8080/api/analyze-claim");
  assert.equal(called.body.text, "Lightning often strikes the same place repeatedly.");
  assert.equal(doc.getElementById("result").hidden, false);
  assert.match(doc.getElementById("result").textContent, /Supported/);
  assert.match(doc.getElementById("result").textContent, /A quoted excerpt/);
  const anchor = doc.querySelector("#result a");
  assert.equal(anchor.rel, "noopener noreferrer");
  assert.equal(anchor.target, "_blank");
  assert.equal(chrome.local.data.history.length, 20);
  assert.equal(chrome.local.data.history[0].id, "check-1");
  dom.window.close();
});

test("panel connection form rejects unsafe URLs and saves allowed localhost origins", async () => {
  const chrome = panelChrome({ permissionHeld: false, permissionGranted: true });
  const dom = await loadPanel(chrome);
  const doc = dom.window.document;
  doc.getElementById("api-url").value = "http://evil.example";
  fire(dom, doc.getElementById("api-form"), "submit");
  for (let i = 0; i < 6; i++) await tick();
  assert.match(doc.getElementById("error").textContent, /HTTPS service origin or localhost/);
  assert.equal(
    chrome.sent.some((message) => message.type === "connect"),
    false,
  );

  doc.getElementById("api-url").value = "http://localhost:18089";
  fire(dom, doc.getElementById("api-form"), "submit");
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(chrome.sent.at(-1).apiUrl, "http://localhost:18089");
  assert.match(doc.getElementById("status").textContent, /Connection saved/);
  assert.equal(doc.getElementById("api-url").value, "http://localhost:18089");
  dom.window.close();
});

test("panel switch toggles background state and storage changes re-sync the UI", async () => {
  const chrome = panelChrome();
  const dom = await loadPanel(chrome);
  const doc = dom.window.document;
  doc.getElementById("enabled").checked = false;
  fire(dom, doc.getElementById("enabled"), "change");
  for (let i = 0; i < 6; i++) await tick();
  const switchMessage = chrome.sent.find((message) => message.type === "set-enabled");
  assert.equal(switchMessage.type, "set-enabled");
  assert.equal(switchMessage.enabled, false);
  assert.equal(doc.getElementById("capture").disabled, true);

  for (const listener of chrome.changes) listener({ enabled: { newValue: true } }, "local");
  assert.equal(doc.getElementById("enabled").checked, true);
  assert.equal(doc.getElementById("capture").disabled, false);
  dom.window.close();
});

test("panel clears extension-local history", async () => {
  const chrome = panelChrome({ local: { history: [fixtureResult()] } });
  const dom = await loadPanel(chrome);
  const doc = dom.window.document;
  assert.equal(doc.getElementById("result").hidden, false);
  fire(dom, doc.getElementById("clear-history"), "click");
  for (let i = 0; i < 4; i++) await tick();
  assert.equal("history" in chrome.local.data, false);
  assert.equal(doc.getElementById("result").hidden, true);
  dom.window.close();
});

function loadBackground(chrome, extras = {}) {
  const listeners = { message: null, menu: null, installed: null };
  const sandbox = {
    chrome: {
      ...chrome,
      runtime: {
        ...chrome.runtime,
        id: "claimlensextensionid00000000000000",
        getURL: (file = "") => `chrome-extension://claimlensextensionid00000000000000/${file}`,
        getManifest: () => ({ version: manifest.version }),
        onInstalled: { addListener: (fn) => (listeners.installed = fn) },
        onMessage: { addListener: (fn) => (listeners.message = fn) },
      },
      sidePanel: {
        setPanelBehavior: async () => {},
        ...(chrome.sidePanel || {}),
        open: async () => {},
      },
      contextMenus: {
        create: () => {},
        onClicked: { addListener: (fn) => (listeners.menu = fn) },
      },
    },
    URL,
    DOMException,
    console,
    // The injected selection function runs in the page, not the worker; emulate that realm.
    window: { getSelection: () => ({ toString: () => "x".repeat(2100) }) },
    ...extras,
  };
  vm.createContext(sandbox);
  vm.runInContext(backgroundSource, sandbox);
  return { sandbox, listeners };
}

function extensionSender() {
  return {
    id: "claimlensextensionid00000000000000",
    url: "chrome-extension://claimlensextensionid00000000000000/panel.html",
  };
}
function websiteSender(origin = "http://localhost:8080") {
  return {
    id: "claimlensextensionid00000000000000",
    tab: { id: 7, windowId: 7, url: `${origin}/` },
  };
}
async function dispatch(listeners, message, sender) {
  let reply;
  listeners.message(message, sender, (data) => (reply = data));
  for (let i = 0; i < 6; i++) await tick();
  return reply;
}

function backgroundChrome(local = {}) {
  const store = storageArea(local);
  return {
    storage: { local: store, session: storageArea(), onChanged: { addListener: () => {} } },
    local: store,
    tabs: {
      query: async () => [{ id: 7, windowId: 7, url: "https://example.org/article" }],
      captureVisibleTab: async () => "data:image/jpeg;base64,AAAA",
    },
    scripting: {
      executeScript: async ({ func }) => [{ result: func() }],
    },
    permissions: { contains: async () => true },
  };
}

test("background rejects website requests outside the small connection API", async () => {
  const chrome = backgroundChrome();
  const { listeners } = loadBackground(chrome);
  const reply = await dispatch(listeners, { type: "capture" }, websiteSender());
  assert.equal(reply.ok, false);
  assert.match(reply.error, /Unsupported website request/);
});

test("background connection validates origin, credentials and path", async () => {
  const chrome = backgroundChrome();
  const { listeners } = loadBackground(chrome);
  const bad = await dispatch(
    listeners,
    { type: "connect", apiUrl: "https://user:pass@example.org/path" },
    extensionSender(),
  );
  assert.equal(bad.ok, false);

  const wrongOrigin = await dispatch(
    listeners,
    { type: "connect", apiUrl: "https://api.example.org" },
    websiteSender("http://localhost:8080"),
  );
  assert.equal(wrongOrigin.ok, false);
  assert.match(wrongOrigin.error, /website’s own backend/);

  const good = await dispatch(
    listeners,
    { type: "connect", apiUrl: "http://localhost:18089" },
    websiteSender("http://localhost:18089"),
  );
  assert.equal(good.ok, true);
  assert.equal(chrome.local.data.apiUrl, "http://localhost:18089");
});

test("background blocks capture while paused and returns bounded capture/selection data", async () => {
  const chrome = backgroundChrome({ enabled: false });
  let { listeners } = loadBackground(chrome);
  const paused = await dispatch(listeners, { type: "capture" }, extensionSender());
  assert.equal(paused.ok, false);
  assert.match(paused.error, /Screen checking is paused/);

  const activeChrome = backgroundChrome();
  ({ listeners } = loadBackground(activeChrome));
  const capture = await dispatch(listeners, { type: "capture" }, extensionSender());
  assert.equal(capture.ok, true);
  assert.equal(capture.data.image, "data:image/jpeg;base64,AAAA");

  const selection = await dispatch(listeners, { type: "selection" }, extensionSender());
  assert.equal(selection.data.text.length, 2000);
});

test("background context menu stores the reviewed selection", async () => {
  const chrome = backgroundChrome();
  const { listeners } = loadBackground(chrome);
  listeners.menu(
    { menuItemId: "cuda-check", selectionText: "y".repeat(2100) },
    { id: 7, windowId: 7 },
  );
  await tick();
  assert.equal((await chrome.storage.session.get("selectedText")).selectedText.length, 2000);
});

function loadBridge(chrome) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:8080/",
    runScripts: "outside-only",
  });
  dom.window.chrome = chrome;
  dom.window.eval(bridgeSource);
  return dom;
}
function post(dom, data, origin = dom.window.location.origin, source = dom.window) {
  dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data, origin, source }));
}

test("bridge filters foreign messages and relays responses with their request id", async () => {
  const sent = [];
  const posted = [];
  const dom = loadBridge({
    runtime: {
      sendMessage: async (message) => {
        sent.push(message);
        return { ok: true, data: { installed: true } };
      },
    },
  });
  dom.window.postMessage = (message) => posted.push(message);
  post(dom, { channel: "OTHER", id: "a", type: "get-status" });
  post(dom, { channel: "CUDA_AI_WEBSITE", id: "b", type: "get-status" }, "https://evil.example");
  await tick();
  assert.equal(sent.length, 0);

  post(dom, { channel: "CUDA_AI_WEBSITE", id: "c", type: "get-status" });
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "get-status");
  assert.equal(sent[0].enabled, undefined);
  assert.equal(sent[0].apiUrl, undefined);
  assert.equal(posted[0].channel, "CUDA_AI_EXTENSION");
  assert.equal(posted[0].id, "c");
  assert.equal(posted[0].ok, true);
  assert.equal(posted[0].data.installed, true);
  dom.window.close();
});

test("bridge reports transport errors with the original request id", async () => {
  const posted = [];
  const dom = loadBridge({
    runtime: {
      sendMessage: async () => {
        throw new Error("no receiver");
      },
    },
  });
  dom.window.postMessage = (message) => posted.push(message);
  post(dom, { channel: "CUDA_AI_WEBSITE", id: "failed", type: "get-status" });
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(posted[0].id, "failed");
  assert.equal(posted[0].ok, false);
  assert.match(posted[0].error, /Reload this page/);
  dom.window.close();
});
