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
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
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
    windows: { getCurrent: async () => ({ id: options.windowId || 7 }) },
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
  for (const [size, file] of Object.entries(manifest.icons)) {
    const icon = fs.readFileSync(path.join(extDir, file));
    assert.equal(icon.readUInt32BE(16), Number(size));
    assert.equal(icon.readUInt32BE(20), Number(size));
  }
});

test("panel removes preferences and old paused state cannot block screen search", async () => {
  const dom = await loadPanel(panelChrome({ enabled: false }));
  const doc = dom.window.document;
  for (const id of ["settings", "enabled", "api-url", "read"])
    assert.equal(doc.getElementById(id), null);
  assert.equal(doc.getElementById("capture").disabled, false);
  assert.equal(doc.getElementById("capture").textContent, "Search on screen");
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

test("one screen-search click reads the crop, fills the claim and verifies automatically", async () => {
  const chrome = panelChrome({
    sendMessage: async (message) =>
      message.type === "get-status"
        ? { ok: true, data: { apiUrl: "http://localhost:18089", enabled: false } }
        : { ok: true, data: { image: "data:image/jpeg;base64,cropped" } },
  });
  const calls = [];
  const dom = await loadPanel(chrome, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return jsonResponse(
      url.endsWith("extract-screen")
        ? { claims: ["Lightning often strikes the same place repeatedly."] }
        : fixtureResult(),
    );
  });
  fire(dom, dom.window.document.getElementById("capture"));
  fire(dom, dom.window.document.getElementById("capture"));
  for (let i = 0; i < 16; i++) await tick();
  assert.equal(chrome.sent.filter((message) => message.type === "capture-region").length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.image, "data:image/jpeg;base64,cropped");
  assert.equal(calls[1].body.text, "Lightning often strikes the same place repeatedly.");
  assert.equal(dom.window.document.getElementById("claim").value, calls[1].body.text);
  assert.equal(dom.window.document.getElementById("result").hidden, false);
  assert.equal(chrome.local.data.history.length, 1);
  assert.equal(dom.window.document.getElementById("capture").disabled, false);
  dom.window.close();
});

test("cancelled selection makes no OCR or verification request", async () => {
  const chrome = panelChrome({
    sendMessage: async (message) =>
      message.type === "get-status"
        ? { ok: true, data: { apiUrl: "http://localhost:8080" } }
        : { ok: true, data: { cancelled: true } },
  });
  const dom = await loadPanel(chrome);
  fire(dom, dom.window.document.getElementById("capture"));
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(dom.window.document.getElementById("preview").hidden, true);
  assert.equal(dom.window.document.getElementById("error").hidden, true);
  assert.equal(dom.window.document.getElementById("capture").disabled, false);
  dom.window.close();
});

test("unreadable crop shows a friendly error and never starts a fact check", async () => {
  const chrome = panelChrome({
    sendMessage: async (message) =>
      message.type === "get-status"
        ? { ok: true, data: { apiUrl: "http://localhost:8080" } }
        : { ok: true, data: { image: "data:image/jpeg;base64,cropped" } },
  });
  const calls = [];
  const dom = await loadPanel(chrome, async (url) => {
    calls.push(url);
    return jsonResponse({ claims: [] });
  });
  fire(dom, dom.window.document.getElementById("capture"));
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(calls.length, 1);
  assert.match(dom.window.document.getElementById("error").textContent, /No legible factual claim/);
  assert.equal(dom.window.document.getElementById("capture").disabled, false);
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
    document: { activeElement: null },
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

test("background allows explicit capture after the removed switch was previously disabled", async () => {
  const chrome = backgroundChrome({ enabled: false });
  const { listeners } = loadBackground(chrome);
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

test("native crop applies display scaling and only encodes the selected rectangle", async () => {
  const draws = [];
  let closed = false;
  class Canvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return { drawImage: (...args) => draws.push(args) };
    }
    async convertToBlob() {
      return new Blob([new Uint8Array([255, 216, 255, 1, 2])], { type: "image/jpeg" });
    }
  }
  const { sandbox } = loadBackground(backgroundChrome(), {
    atob,
    btoa,
    Blob,
    Uint8Array,
    OffscreenCanvas: Canvas,
    createImageBitmap: async () => ({ width: 2400, height: 1600, close: () => (closed = true) }),
  });
  const image = await sandbox.cropScreen("data:image/png;base64,AAAA", {
    x: 100,
    y: 200,
    width: 300,
    height: 100,
    viewportWidth: 1200,
    viewportHeight: 800,
  });
  assert.equal(image, "data:image/jpeg;base64,/9j/AQI=");
  assert.deepEqual(draws[0].slice(1), [200, 400, 600, 200, 0, 0, 600, 200]);
  assert.equal(closed, true);
  await assert.rejects(
    () =>
      sandbox.cropScreen("data:image/png;base64,AAAA", {
        x: -1,
        y: 0,
        width: 300,
        height: 100,
        viewportWidth: 1200,
        viewportHeight: 800,
      }),
    /invalid/,
  );
});

test("panel forwards its own browser window for capture", async () => {
  const chrome = panelChrome({ windowId: 42 });
  const dom = await loadPanel(chrome);
  fire(dom, dom.window.document.getElementById("capture"));
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(chrome.sent.find((message) => message.type === "capture-region").windowId, 42);
  dom.window.close();
});

test("selected text starts verification and clears a stale result on failure", async () => {
  let fail = false;
  const chrome = panelChrome({
    sendMessage: async (message) =>
      message.type === "get-status"
        ? { ok: true, data: { apiUrl: "http://localhost:8080" } }
        : fail
          ? { ok: false, error: "Click the Verity icon in this window’s toolbar." }
          : { ok: true, data: { text: "  Lightning often strikes the same place repeatedly.  " } },
  });
  const calls = [];
  const dom = await loadPanel(chrome, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return jsonResponse(fixtureResult());
  });
  fire(dom, dom.window.document.getElementById("selection"));
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.text, "Lightning often strikes the same place repeatedly.");
  assert.equal(dom.window.document.getElementById("result").hidden, false);
  fail = true;
  fire(dom, dom.window.document.getElementById("selection"));
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(dom.window.document.getElementById("result").hidden, true);
  assert.match(dom.window.document.getElementById("error").textContent, /toolbar/);
  assert.equal(dom.window.document.getElementById("selection").disabled, false);
  dom.window.close();
});

test("background targets the panel window even when another window is focused", async () => {
  const chrome = backgroundChrome();
  const queries = [];
  chrome.tabs.query = async (query) => {
    queries.push(query);
    return [{ id: 23, windowId: 42, url: "https://example.org" }];
  };
  const { listeners } = loadBackground(chrome);
  const reply = await dispatch(listeners, { type: "capture", windowId: 42 }, extensionSender());
  assert.equal(reply.ok, true);
  assert.equal(queries[0].windowId, 42);
  assert.equal(queries[0].currentWindow, undefined);
});

test("missing activeTab access explains the toolbar action instead of a protected page", async () => {
  const chrome = backgroundChrome();
  chrome.scripting.executeScript = async () => {
    throw new Error("Cannot access contents of url. Extension manifest must request permission.");
  };
  const { listeners } = loadBackground(chrome);
  const selection = await dispatch(listeners, { type: "selection" }, extensionSender());
  assert.equal(selection.ok, false);
  assert.match(selection.error, /Click the Verity icon.*toolbar/);
  chrome.tabs.captureVisibleTab = async () => {
    throw new Error("Either the '<all_urls>' or 'activeTab' permission is required.");
  };
  const capture = await dispatch(listeners, { type: "capture" }, extensionSender());
  assert.match(capture.error, /Opening a new site/);
});

test("restricted browser pages and extension stores are rejected before injection", async () => {
  for (const url of [
    "chrome://newtab",
    "edge://settings",
    "https://chromewebstore.google.com/detail/test",
    "https://microsoftedge.microsoft.com/addons/detail/test",
  ]) {
    const chrome = backgroundChrome();
    chrome.tabs.query = async () => [{ id: 7, windowId: 7, url }];
    chrome.scripting.executeScript = async () => {
      throw new Error("must not inject");
    };
    const { listeners } = loadBackground(chrome);
    const reply = await dispatch(listeners, { type: "selection" }, extensionSender());
    assert.match(reply.error, /protected pages/);
  }
});

test("text selection includes editable controls and frames, excluding password values", async () => {
  const { sandbox } = loadBackground(backgroundChrome());
  sandbox.document.activeElement = {
    tagName: "TEXTAREA",
    value: "before selected claim after",
    selectionStart: 7,
    selectionEnd: 21,
  };
  assert.equal(sandbox.readSelectedText(), "selected claim");
  sandbox.document.activeElement = {
    tagName: "INPUT",
    type: "password",
    value: "secret",
    selectionStart: 0,
    selectionEnd: 6,
  };
  sandbox.window.getSelection = () => ({ toString: () => "" });
  assert.equal(sandbox.readSelectedText(), "");
  sandbox.document.activeElement = { tagName: "IFRAME" };
  sandbox.window.getSelection = () => ({ toString: () => "An older parent selection" });
  assert.equal(sandbox.readSelectedText(), "");
  const chrome = backgroundChrome();
  let target;
  chrome.scripting.executeScript = async (options) => {
    target = options.target;
    return [
      { frameId: 0, result: "" },
      { frameId: 12, result: "A claim inside an accessible frame." },
    ];
  };
  const { listeners } = loadBackground(chrome);
  const reply = await dispatch(listeners, { type: "selection" }, extensionSender());
  assert.equal(target.allFrames, true);
  assert.equal(reply.data.text, "A claim inside an accessible frame.");
});

test("a tab changed during region selection is never captured", async () => {
  const chrome = backgroundChrome();
  let queries = 0;
  chrome.tabs.query = async () => [
    { id: ++queries === 1 ? 7 : 8, windowId: 7, url: "https://example.org/article" },
  ];
  chrome.scripting.executeScript = async () => [
    { result: { x: 0, y: 0, width: 30, height: 30, viewportWidth: 100, viewportHeight: 100 } },
  ];
  chrome.tabs.captureVisibleTab = async () => {
    throw new Error("must not capture");
  };
  const { listeners } = loadBackground(chrome);
  const reply = await dispatch(listeners, { type: "capture-region" }, extensionSender());
  assert.match(reply.error, /active page changed/);
});

test("only one region selector runs per page and cancellation releases the lock", async () => {
  const chrome = backgroundChrome();
  let resolveSelection;
  let injections = 0;
  chrome.scripting.executeScript = () => {
    injections++;
    return new Promise((resolve) => {
      resolveSelection = resolve;
    });
  };
  const { listeners } = loadBackground(chrome);
  let firstReply;
  listeners.message({ type: "capture-region" }, extensionSender(), (reply) => {
    firstReply = reply;
  });
  await tick();
  const duplicate = await dispatch(listeners, { type: "capture-region" }, extensionSender());
  assert.match(duplicate.error, /Finish or cancel/);
  assert.equal(injections, 1);
  resolveSelection([{ result: { cancelled: true } }]);
  await tick();
  assert.equal(firstReply.data.cancelled, true);
  chrome.scripting.executeScript = async () => [{ result: { cancelled: true } }];
  const retry = await dispatch(listeners, { type: "capture-region" }, extensionSender());
  assert.equal(retry.ok, true);
});

test("right-click selection verifies automatically only in its owning browser window", async () => {
  const chrome = panelChrome({
    windowId: 42,
    session: {
      selectedText: "Lightning often strikes the same place repeatedly.",
      selectedWindowId: 7,
    },
  });
  let calls = 0;
  const dom = await loadPanel(chrome, async () => {
    calls++;
    return jsonResponse(fixtureResult());
  });
  assert.equal(calls, 0);
  assert.equal(chrome.session.data.selectedWindowId, 7);
  chrome.session.data.selectedWindowId = 42;
  chrome.changes[0]({ selectedText: { newValue: chrome.session.data.selectedText } }, "session");
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(calls, 1);
  assert.equal(dom.window.document.getElementById("result").hidden, false);
  assert.equal(chrome.session.data.selectedText, undefined);
  dom.window.close();
});

test("history storage failure does not hide or misreport a completed check", async () => {
  const chrome = panelChrome();
  chrome.storage.local.set = async () => {
    throw new Error("storage quota");
  };
  const dom = await loadPanel(chrome, async () => jsonResponse(fixtureResult()));
  dom.window.document.getElementById("claim").value =
    "Lightning often strikes the same place repeatedly.";
  fire(dom, dom.window.document.getElementById("check-form"), "submit");
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(dom.window.document.getElementById("result").hidden, false);
  assert.match(dom.window.document.getElementById("error").textContent, /check completed.*save/);
  dom.window.close();
});

test("crop text fills the field before OCR finishes and survives a vision failure", async () => {
  const text = "Lightning often strikes the same place repeatedly.";
  const chrome = panelChrome({
    sendMessage: async (message) =>
      message.type === "get-status"
        ? { ok: true, data: { apiUrl: "http://localhost:8080" } }
        : { ok: true, data: { text, image: "data:image/jpeg;base64,cropped" } },
  });
  let rejectOcr;
  const calls = [];
  const dom = await loadPanel(chrome, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith("extract-screen"))
      return new Promise((_, reject) => {
        rejectOcr = reject;
      });
    return jsonResponse(fixtureResult());
  });
  fire(dom, dom.window.document.getElementById("capture"));
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(dom.window.document.getElementById("claim").value, text);
  assert.equal(dom.window.document.getElementById("result").hidden, true);
  rejectOcr(new Error("vision unavailable"));
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(calls[1].body.text, text);
  assert.equal(dom.window.document.getElementById("result").hidden, false);
  dom.window.close();
});

test("readable cropped page text can be checked without screenshot permission", async () => {
  const chrome = backgroundChrome();
  chrome.scripting.executeScript = async () => [
    {
      result: {
        x: 0,
        y: 0,
        width: 50,
        height: 30,
        viewportWidth: 100,
        viewportHeight: 100,
        text: "Lightning strikes repeatedly.",
      },
    },
  ];
  chrome.tabs.captureVisibleTab = async () => {
    throw new Error("activeTab permission required");
  };
  const { listeners } = loadBackground(chrome);
  const reply = await dispatch(listeners, { type: "capture-region" }, extensionSender());
  assert.equal(reply.ok, true);
  assert.equal(reply.data.text, "Lightning strikes repeatedly.");
  assert.equal(reply.data.image, undefined);
});

test("both crop commands start neutral with neither button focused or pressed", async () => {
  const dom = await loadPanel(panelChrome());
  for (const id of ["capture", "selection"]) {
    const button = dom.window.document.getElementById(id);
    assert.ok(button.classList.contains("secondary"));
    assert.equal(button.getAttribute("aria-pressed"), null);
    assert.equal(button.getAttribute("aria-busy"), "false");
    assert.notEqual(dom.window.document.activeElement, button);
  }
  dom.window.close();
});

test("crop release resolves even when browser animation frames never run", async () => {
  const dom = new JSDOM(
    '<!doctype html><body><p id="inside">The Sun is a planet.</p><p id="outside">Text outside the crop.</p></body>',
    { pretendToBeVisual: true },
  );
  const win = dom.window;
  Object.defineProperty(win.ShadowRoot.prototype, "adoptedStyleSheets", {
    configurable: true,
    set() {},
  });
  const attach = win.Element.prototype.attachShadow;
  win.Element.prototype.attachShadow = function () {
    return attach.call(this, { mode: "open" });
  };
  win.Element.prototype.setPointerCapture = () => {};
  const rect = (node, start = 0, end = node.textContent.length) => {
    const y = node.parentElement.id === "inside" ? 10 : 70;
    return {
      left: 10 + start,
      right: 10 + end,
      top: y,
      bottom: y + 15,
      width: end - start,
      height: 15,
    };
  };
  win.Range.prototype.getClientRects = function () {
    return [rect(this.startContainer)];
  };
  win.Range.prototype.getBoundingClientRect = function () {
    return rect(this.startContainer, this.startOffset, this.endOffset);
  };
  const { sandbox } = loadBackground(backgroundChrome(), {
    window: win,
    document: win.document,
    HTMLElement: win.HTMLElement,
    NodeFilter: win.NodeFilter,
    innerWidth: 100,
    innerHeight: 100,
    getComputedStyle: () => ({ visibility: "visible", display: "block", opacity: "1" }),
    CSSStyleSheet: class {
      replaceSync() {}
    },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: () => 0,
  });
  const pending = sandbox.selectScreenRegion();
  const overlay = win.document
    .getElementById("verity-screen-selector")
    .shadowRoot.querySelector(".overlay");
  overlay.dispatchEvent(new win.MouseEvent("pointerdown", { button: 0, clientX: 5, clientY: 5 }));
  overlay.dispatchEvent(new win.MouseEvent("pointerup", { button: 0, clientX: 70, clientY: 35 }));
  const region = await pending;
  assert.equal(region.text, "The Sun is a planet.");
  assert.equal(win.document.getElementById("verity-screen-selector"), null);
  dom.window.close();
});
