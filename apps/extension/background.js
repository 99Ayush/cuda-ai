const DEFAULT_API = "http://localhost:8080";
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  // Defaults are read lazily; installation never overwrites a user connection.
  chrome.contextMenus.create({ id: "cuda-check", title: "Verify selected claim with ClaimLens", contexts: ["selection"] });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "cuda-check" || !info.selectionText || !tab?.id) return;
  // Open synchronously inside the gesture; storage continues independently.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  chrome.storage.session.set({ selectedText: info.selectionText.slice(0, 2000) });
});

function validApi(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
async function extensionStatus() {
  const value = await chrome.storage.local.get(["enabled", "apiUrl"]);
  return { installed: true, enabled: value.enabled !== false, apiUrl: value.apiUrl || DEFAULT_API, version: chrome.runtime.getManifest().version };
}
async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id) throw new Error("Unknown sender.");
  const fromWebsite = !sender.url?.startsWith(chrome.runtime.getURL(""));
  if (fromWebsite && !["get-status", "set-enabled", "connect"].includes(message.type)) throw new Error("Unsupported website request.");
  if (message.type === "get-status") return extensionStatus();
  if (message.type === "set-enabled") {
    if (typeof message.enabled !== "boolean") throw new Error("Invalid switch value.");
    await chrome.storage.local.set({ enabled: message.enabled });
    return extensionStatus();
  }
  if (message.type === "connect") {
    const apiUrl = validApi(message.apiUrl);
    if (!apiUrl || (fromWebsite && new URL(sender.tab.url).origin !== apiUrl)) throw new Error("Choose the website’s own backend URL.");
    if (!await chrome.permissions.contains({ origins: [`${apiUrl}/*`] })) throw new Error("Allow access to this API in the extension settings first.");
    await chrome.storage.local.set({ apiUrl });
    return extensionStatus();
  }
  if (!(await extensionStatus()).enabled) throw new Error("Screen checking is paused. Enable it in Settings.");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || "")) throw new Error("Open a normal web page. Browser settings and protected pages cannot be captured.");
  if (message.type === "capture") {
    const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 });
    return { image };
  }
  if (message.type === "selection") {
    const rows = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString().slice(0, 2000) || "" });
    return { text: rows[0]?.result || "" };
  }
  throw new Error("Unknown extension action.");
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  handle(message, sender).then(data => reply({ ok: true, data }), error => reply({ ok: false, error: error.message }));
  return true;
});
