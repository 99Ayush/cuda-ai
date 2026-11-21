import { ServiceError, abortError } from "./errors";
type Waiter = { grant: () => void; cancel: () => void };
export class JobQueue {
  private active = 0;
  private waiting: Waiter[] = [];
  constructor(
    private concurrency = 4,
    private limit = 20,
  ) {}
  private acquire(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.active < this.concurrency) {
      this.active++;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.limit)
      throw new ServiceError(503, "QUEUE_FULL", "The service is busy. Retry after a short wait.");
    return new Promise((resolve, reject) => {
      const remove = () => {
        const index = this.waiting.indexOf(waiter);
        if (index >= 0) this.waiting.splice(index, 1);
        signal.removeEventListener("abort", cancel);
      };
      const cancel = () => {
        remove();
        reject(abortError());
      };
      const waiter: Waiter = {
        cancel,
        grant: () => {
          remove();
          if (signal.aborted) {
            reject(abortError());
            this.releaseNext();
            return;
          }
          this.active++;
          resolve();
        },
      };
      this.waiting.push(waiter);
      signal.addEventListener("abort", cancel, { once: true });
    });
  }
  private releaseNext() {
    const next = this.waiting.shift();
    next?.grant();
  }
  async run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      signal.throwIfAborted();
      return await task();
    } finally {
      this.active--;
      this.releaseNext();
    }
  }
  get state() {
    return {
      active: this.active,
      queued: this.waiting.length,
      capacity: this.concurrency,
      queue_limit: this.limit,
    };
  }
}
export class TokenBucket {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(
    private capacity = 10,
    private windowMs = 60000,
    private now = Date.now,
    private maxKeys = 10000,
  ) {}
  take(key: string): { allowed: boolean; retryAfter: number } {
    const current = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, updated: current };
      this.buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + ((current - bucket.updated) * this.capacity) / this.windowMs,
    );
    bucket.updated = current;
    if (this.buckets.size > this.maxKeys) this.buckets.delete(this.buckets.keys().next().value!);
    if (bucket.tokens < 1)
      return {
        allowed: false,
        retryAfter: Math.max(
          1,
          Math.ceil(((1 - bucket.tokens) * this.windowMs) / this.capacity / 1000),
        ),
      };
    bucket.tokens--;
    return { allowed: true, retryAfter: 0 };
  }
}
