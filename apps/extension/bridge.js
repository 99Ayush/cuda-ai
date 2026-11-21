window.addEventListener("message", async (event) => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    event.data?.channel !== "CUDA_AI_WEBSITE"
  )
    return;
  const { id, type, enabled, apiUrl } = event.data;
  if (typeof id !== "string" || !["get-status", "set-enabled", "connect"].includes(type)) return;
  try {
    const response = await chrome.runtime.sendMessage({ type, enabled, apiUrl });
    window.postMessage({ channel: "CUDA_AI_EXTENSION", id, ...response }, window.location.origin);
  } catch {
    window.postMessage(
      {
        channel: "CUDA_AI_EXTENSION",
        id,
        ok: false,
        error: "Reload this page after updating the extension.",
      },
      window.location.origin,
    );
  }
});
