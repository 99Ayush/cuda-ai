import { z } from "zod";
import {
  ResultSchema,
  StageSchema,
  type Result,
  type CheckInput,
  type ProgressEvent,
} from "@verity/shared";
const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
function failure(
  error: unknown,
  signal?: AbortSignal | null,
  message = "The service returned an unreadable response. Retry shortly.",
): Error {
  if (signal?.aborted)
    return new Error("Check cancelled. Your input is still here when you are ready.", {
      cause: error,
    });
  if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
    return new Error("This check took too long. Please try again.", { cause: error });
  return new Error(message, { cause: error });
}
function message(data: unknown): string {
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string")
    return data.message;
  return "The check could not be completed. Please try again.";
}
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${base}/api/${path}`, {
      ...options,
      headers,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(115000)])
        : AbortSignal.timeout(115000),
    });
  } catch (error) {
    throw failure(
      error,
      options.signal,
      "Could not reach the fact-checking service. Check your connection and try again.",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("The fact-checking service is unavailable. Please try again later.");
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw failure(error, options.signal);
  }
  if (!response.ok) throw new Error(message(data));
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new Error("The service returned an incomplete result. Retry shortly.");
    return parsed.data;
  }
  return data as T;
}
const Progress = z.object({
  stage: StageSchema,
  detail: z.string(),
  elapsed_ms: z.number().nonnegative(),
});
export async function streamCheck(
  input: CheckInput,
  onProgress: (value: ProgressEvent) => void,
  signal: AbortSignal,
): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/checks/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.any([signal, AbortSignal.timeout(115000)]),
    });
  } catch (error) {
    throw failure(
      error,
      signal,
      "Could not reach the fact-checking service. Check your connection and retry.",
    );
  }
  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error("The service is unavailable. Retry shortly.");
    }
    throw new Error(message(data));
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body)
    throw new Error("The service did not return progress data. Retry shortly.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    received = 0,
    pendingCR = false;
  try {
    for (;;) {
      const chunk = await reader.read();
      received += chunk.value?.length || 0;
      if (received > 2_000_000) {
        await reader.cancel();
        throw new Error("This result was too large. Use a shorter claim.");
      }
      let decoded = decoder.decode(chunk.value, { stream: !chunk.done });
      if (pendingCR) decoded = "\r" + decoded;
      pendingCR = !chunk.done && decoded.endsWith("\r");
      if (pendingCR) decoded = decoded.slice(0, -1);
      buffer += decoded.replace(/\r\n|\r/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const name = event
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const raw = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!raw || !["stage", "result", "error"].includes(name || "")) continue;
        const data: unknown = JSON.parse(raw);
        if (name === "stage") onProgress(Progress.parse(data));
        else if (name === "result") return ResultSchema.parse(data);
        else if (name === "error") throw new Error(message(data));
      }
      if (chunk.done) break;
    }
  } catch (error) {
    if (signal.aborted || error instanceof DOMException) throw failure(error, signal);
    if (error instanceof SyntaxError || error instanceof z.ZodError)
      throw failure(error, signal, "The service returned unreadable progress. Retry shortly.");
    if (error instanceof TypeError)
      throw failure(error, signal, "The connection ended unexpectedly. Please retry your check.");
    throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  throw new Error("The progress stream ended without a complete result. Retry shortly.");
}
