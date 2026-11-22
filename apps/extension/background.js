const DEFAULT_API = "http://localhost:8080";
const regionSelections = new Set();
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  // Defaults are read lazily; installation never overwrites a user connection.
  chrome.contextMenus.create({
    id: "cuda-check",
    title: "Verify selected claim with Verity",
    contexts: ["selection"],
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "cuda-check" || !info.selectionText || !tab?.id) return;
  // Open synchronously inside the gesture; storage continues independently.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  chrome.storage.session.set({
    selectedText: info.selectionText.slice(0, 2000),
    selectedWindowId: tab.windowId,
  });
});

function validApi(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
async function extensionStatus() {
  const value = await chrome.storage.local.get(["enabled", "apiUrl"]);
  return {
    installed: true,
    enabled: true,
    apiUrl: value.apiUrl || DEFAULT_API,
    version: chrome.runtime.getManifest().version,
  };
}
async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id) throw new Error("Unknown sender.");
  const fromWebsite = !sender.url?.startsWith(chrome.runtime.getURL(""));
  if (fromWebsite && !["get-status", "set-enabled", "connect"].includes(message.type))
    throw new Error("Unsupported website request.");
  if (message.type === "get-status") return extensionStatus();
  if (message.type === "set-enabled") {
    if (typeof message.enabled !== "boolean") throw new Error("Invalid switch value.");
    await chrome.storage.local.set({ enabled: message.enabled });
    return extensionStatus();
  }
  if (message.type === "connect") {
    const apiUrl = validApi(message.apiUrl);
    if (!apiUrl || (fromWebsite && new URL(sender.tab.url).origin !== apiUrl))
      throw new Error("Choose the website’s own backend URL.");
    if (!(await chrome.permissions.contains({ origins: [`${apiUrl}/*`] })))
      throw new Error("Allow access to this API in the extension settings first.");
    await chrome.storage.local.set({ apiUrl });
    return extensionStatus();
  }
  if (!["capture", "capture-region", "selection"].includes(message.type))
    throw new Error("Unknown extension action.");
  // A side panel belongs to a browser window; the worker has no window of its own.
  const windowId = message.windowId ?? sender.tab?.windowId;
  const query = Number.isInteger(windowId)
    ? { active: true, windowId }
    : { active: true, currentWindow: true };
  const [tab] = await chrome.tabs.query(query);
  if (!tab?.id) throw new Error("Choose a web page in this browser window, then try again.");
  if (
    !/^https?:\/\//.test(tab.url || "") ||
    /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore|microsoftedge\.microsoft\.com\/addons)(\/|$)/.test(
      tab.url,
    )
  )
    throw new Error(
      "Open a normal web page. Browser settings and protected pages cannot be captured.",
    );
  if (message.type === "capture") {
    const image = await capturePage(tab, {
      format: "jpeg",
      quality: 85,
    });
    return { image };
  }
  if (message.type === "capture-region") {
    if (regionSelections.has(tab.id))
      throw new Error("Finish or cancel the area already being selected.");
    regionSelections.add(tab.id);
    try {
      const rows = await pageScript({ target: { tabId: tab.id }, func: selectScreenRegion });
      const region = rows[0]?.result;
      if (!region || region.cancelled) return { cancelled: true };
      const [current] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      if (current?.id !== tab.id || current.windowId !== tab.windowId || current.url !== tab.url)
        throw new Error("The active page changed. Select the area again.");
      const text = typeof region.text === "string" ? region.text.trim().slice(0, 2000) : "";
      try {
        const image = await capturePage(tab, { format: "png" });
        return { image: await cropScreen(image, region), text };
      } catch (error) {
        // Readable page text does not require a screenshot or vision service.
        if (text.length >= 8) return { text };
        throw error;
      }
    } finally {
      regionSelections.delete(tab.id);
    }
  }
  if (message.type === "selection") {
    const rows = await pageScript({
      target: { tabId: tab.id, allFrames: true },
      func: readSelectedText,
    });
    const text =
      rows.find((row) => row.frameId === 0 && row.result?.trim())?.result ||
      rows.find((row) => row.result?.trim())?.result ||
      "";
    return { text };
  }
  throw new Error("Unknown extension action.");
}
function pageAccessError(error) {
  if (
    /permission|cannot access|cannot be scripted|not allowed|activeTab|all_urls/i.test(
      error.message,
    )
  )
    return new Error(
      "Click the Verity icon in this window’s toolbar while viewing this page, then try again. Opening a new site requires another toolbar click.",
      { cause: error },
    );
  return error;
}
async function pageScript(options) {
  try {
    return await chrome.scripting.executeScript(options);
  } catch (error) {
    throw pageAccessError(error);
  }
}
async function capturePage(tab, options) {
  try {
    return await chrome.tabs.captureVisibleTab(tab.windowId, options);
  } catch (error) {
    throw pageAccessError(error);
  }
}
// Runs inside each accessible page frame, including editable text controls.
function readSelectedText() {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  // A focused frame owns the current selection; ignore an older selection in its parent.
  if (["IFRAME", "FRAME"].includes(active?.tagName) || active?.type === "password") return "";
  if (
    active &&
    ["INPUT", "TEXTAREA"].includes(active.tagName) &&
    active.type !== "password" &&
    Number.isInteger(active.selectionStart) &&
    Number.isInteger(active.selectionEnd)
  )
    return active.value.slice(active.selectionStart, active.selectionEnd).slice(0, 2000);
  return window.getSelection()?.toString().slice(0, 2000) || "";
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  handle(message, sender).then(
    (data) => reply({ ok: true, data }),
    (error) => reply({ ok: false, error: error.message }),
  );
  return true;
});

// Injected into the active page. Everything used here lives in that isolated realm.
function selectScreenRegion() {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.id = "verity-screen-selector";
    Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "2147483647" });
    const shadow = host.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      * { box-sizing: border-box; }
      .overlay { position: fixed; inset: 0; cursor: crosshair; touch-action: none; user-select: none; background: #12211e55; }
      .tools { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 24px; padding: 12px 16px; max-width: calc(100vw - 32px); border: 1px solid #526b5a; border-radius: 12px; background: #20332c; color: #f4f0e5; font: 14px/1.5 system-ui; box-shadow: 0 8px 24px #0004; }
      button { background: #f4a57c; color: #12211e; border: 0; border-radius: 8px; min-height: 40px; padding: 8px 16px; font: inherit; cursor: pointer; }
      button:focus-visible { outline: 3px solid #ffd0a6; outline-offset: 3px; }
      .region { display: none; position: absolute; border: 1px solid #f4a57c; box-shadow: 0 0 0 9999px #12211e77; pointer-events: none; }
    `);
    shadow.adoptedStyleSheets = [sheet];
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    const tools = document.createElement("div");
    tools.className = "tools";
    const hint = document.createElement("span");
    hint.textContent = "Drag over a claim. Release to search.";
    hint.setAttribute("role", "status");
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    const box = document.createElement("div");
    box.className = "region";
    tools.append(hint, cancel);
    overlay.append(box, tools);
    shadow.append(overlay);
    document.documentElement.append(host);
    const previousFocus = document.activeElement;
    cancel.focus({ preventScroll: true });
    const width = innerWidth,
      height = innerHeight;
    let start = null,
      finished = false;
    const position = (event) => ({
      x: Math.max(0, Math.min(width, event.clientX)),
      y: Math.max(0, Math.min(height, event.clientY)),
    });
    function textInRegion(region) {
      const right = region.x + region.width,
        bottom = region.y + region.height;
      const intersects = (r) =>
        r.width > 0 &&
        r.height > 0 &&
        r.right > region.x &&
        r.left < right &&
        r.bottom > region.y &&
        r.top < bottom;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      const parts = [];
      let node,
        inspected = 0,
        characters = 0,
        length = 0;
      while (
        (node = walker.nextNode()) &&
        inspected++ < 2000 &&
        characters < 12000 &&
        length < 2000
      ) {
        const parent = node.parentElement;
        if (
          !parent ||
          !node.textContent.trim() ||
          parent.closest("script,style,noscript,textarea,input,[hidden],[aria-hidden='true']")
        )
          continue;
        const style = getComputedStyle(parent);
        if (
          style.visibility === "hidden" ||
          style.display === "none" ||
          Number(style.opacity) === 0
        )
          continue;
        range.selectNodeContents(node);
        if (!Array.from(range.getClientRects()).some(intersects)) continue;
        let text = "";
        for (
          let index = 0;
          index < node.textContent.length && characters++ < 12000 && length + text.length < 2000;
          index++
        ) {
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const r = range.getBoundingClientRect();
          const x = (r.left + r.right) / 2,
            y = (r.top + r.bottom) / 2;
          if (
            r.width > 0 &&
            r.height > 0 &&
            x >= region.x &&
            x <= right &&
            y >= region.y &&
            y <= bottom
          )
            text += node.textContent[index];
        }
        if (text.trim()) {
          parts.push(text.trim());
          length += text.length + 1;
        }
      }
      return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 2000);
    }
    function finish(value) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("wheel", preventScroll, true);
      window.removeEventListener("resize", resized);
      host.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
      // Wait for the compositor to remove the overlay before native capture.
      let delivered = false;
      const deliver = () => {
        if (delivered) return;
        delivered = true;
        clearTimeout(paintFallback);
        resolve(value);
      };
      const paintFallback = setTimeout(deliver, 100);
      requestAnimationFrame(() => requestAnimationFrame(deliver));
    }
    function key(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish({ cancelled: true });
      } else if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)
      )
        event.preventDefault();
    }
    function preventScroll(event) {
      event.preventDefault();
    }
    function resized() {
      finish({ cancelled: true });
    }
    const timeout = setTimeout(() => finish({ cancelled: true }), 120000);
    window.addEventListener("keydown", key, true);
    window.addEventListener("wheel", preventScroll, { capture: true, passive: false });
    window.addEventListener("resize", resized);
    cancel.addEventListener("click", () => finish({ cancelled: true }));
    overlay.addEventListener("contextmenu", (event) => event.preventDefault());
    overlay.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || tools.contains(event.target)) return;
      start = position(event);
      overlay.setPointerCapture(event.pointerId);
      overlay.style.background = "transparent";
      box.style.display = "block";
      Object.assign(box.style, {
        left: `${start.x}px`,
        top: `${start.y}px`,
        width: "0px",
        height: "0px",
      });
    });
    overlay.addEventListener("pointermove", (event) => {
      if (!start) return;
      const end = position(event);
      Object.assign(box.style, {
        left: `${Math.min(start.x, end.x)}px`,
        top: `${Math.min(start.y, end.y)}px`,
        width: `${Math.abs(end.x - start.x)}px`,
        height: `${Math.abs(end.y - start.y)}px`,
      });
    });
    overlay.addEventListener("pointerup", (event) => {
      if (!start) return;
      const end = position(event);
      const region = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        viewportWidth: width,
        viewportHeight: height,
      };
      start = null;
      if (region.width < 12 || region.height < 12) {
        hint.textContent = "Select a larger area, or click Cancel.";
        return;
      }
      try {
        region.text = textInRegion(region);
      } catch {
        region.text = "";
      }
      finish(region);
    });
    overlay.addEventListener("pointercancel", () => finish({ cancelled: true }));
  });
}

async function cropScreen(image, region) {
  if (
    ![
      region.x,
      region.y,
      region.width,
      region.height,
      region.viewportWidth,
      region.viewportHeight,
    ].every(Number.isFinite) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width < 12 ||
    region.height < 12 ||
    region.viewportWidth < 1 ||
    region.viewportHeight < 1 ||
    region.x + region.width > region.viewportWidth ||
    region.y + region.height > region.viewportHeight
  )
    throw new Error("The selected area is invalid. Try again.");
  const bytes = Uint8Array.from(atob(image.split(",")[1]), (value) => value.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes]));
  try {
    const scaleX = bitmap.width / region.viewportWidth,
      scaleY = bitmap.height / region.viewportHeight;
    const x = Math.floor(region.x * scaleX),
      y = Math.floor(region.y * scaleY);
    const w = Math.min(bitmap.width - x, Math.ceil(region.width * scaleX)),
      h = Math.min(bitmap.height - y, Math.ceil(region.height * scaleY));
    const scale = Math.min(1, 2048 / Math.max(w, h));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(w * scale)),
      Math.max(1, Math.round(h * scale)),
    );
    canvas.getContext("2d").drawImage(bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height);
    let blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    if (blob.size > 3 * 1024 * 1024)
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    if (blob.size > 3 * 1024 * 1024) throw new Error("Select a smaller area and try again.");
    const output = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < output.length; offset += 16384)
      binary += String.fromCharCode(...output.subarray(offset, offset + 16384));
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } finally {
    bitmap.close();
  }
}
