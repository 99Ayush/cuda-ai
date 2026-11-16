chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cuda-check",
    title: "Check with CUDA AI",
    contexts: ["selection"],
  });
});
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "cuda-check" && info.selectionText) {
    chrome.tabs.create({
      url: `https://cuda-ai.vercel.app/#claim=${encodeURIComponent(info.selectionText.slice(0, 2000))}`,
    });
  }
});
