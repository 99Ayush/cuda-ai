import { createHash } from "node:crypto";
export class TtlCache<T> {
  private values = new Map<string, { value: T; created: number }>();
  constructor(
    private capacity = 100,
    private ttl = 600000,
    private now = Date.now,
  ) {}
  get(key: string): { value: T; age: number } | undefined {
    const item = this.values.get(key);
    if (!item) return;
    if (this.now() - item.created >= this.ttl) {
      this.values.delete(key);
      return;
    }
    this.values.delete(key);
    this.values.set(key, item);
    return { value: structuredClone(item.value), age: this.now() - item.created };
  }
  set(key: string, value: T): void {
    if (this.capacity === 0 || this.ttl === 0) return;
    this.values.delete(key);
    this.values.set(key, { value: structuredClone(value), created: this.now() });
    while (this.values.size > this.capacity) this.values.delete(this.values.keys().next().value!);
  }
  clear(): void {
    this.values.clear();
  }
  get size(): number {
    return this.values.size;
  }
}
export function cacheKey(value: unknown, policy: string): string {
  return createHash("sha256")
    .update(JSON.stringify([value, policy]))
    .digest("hex");
}
