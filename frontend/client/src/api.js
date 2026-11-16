const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
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
    if (options.signal?.aborted)
      throw new Error(
        "Check cancelled. Your input is still here when you are ready.",
        { cause: error },
      );
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new Error("This check took too long. Please try again.", {
        cause: error,
      });
    throw new Error(
      "Could not reach the fact-checking service. Check your connection and try again.",
      { cause: error },
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "The fact-checking service is unavailable. Please try again later.",
    );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "The check could not be completed. Please try again.",
    );
  return data;
}
