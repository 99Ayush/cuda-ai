export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
export function abortError(): DOMException {
  return new DOMException("The operation was cancelled", "AbortError");
}
