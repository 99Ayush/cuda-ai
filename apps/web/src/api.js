const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
function requestFailure(error, signal, message) {
  if (signal?.aborted)
    return new Error("Check cancelled. Your input is still here when you are ready.", { cause: error });
  if (error.name === "TimeoutError" || error.name === "AbortError")
    return new Error("This check took too long. Please try again.", { cause: error });
  return new Error(message, { cause: error });
}
export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}/api/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(110000)])
        : AbortSignal.timeout(110000),
    });
  } catch (error) {
    throw requestFailure(error, options.signal,
      "Could not reach the fact-checking service. Check your connection and try again.",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "The fact-checking service is unavailable. Please try again later.",
    );
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw requestFailure(error, options.signal,
      "The service returned an unreadable response. Please try again.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "The check could not be completed. Please try again.",
    );
  return data;
}
