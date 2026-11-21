import type { Result } from "@claimlens/shared";
const boundaries = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120];
type Histogram = { count: number; sum: number; buckets: number[] };
export class Metrics {
  private histograms = new Map<string, Histogram>();
  private counters = new Map<string, number>();
  increment(name: string, labels = "", amount = 1) {
    const key = `${name}${labels}`;
    this.counters.set(key, (this.counters.get(key) || 0) + amount);
  }
  observe(stage: string, seconds: number) {
    let value = this.histograms.get(stage);
    if (!value) {
      value = { count: 0, sum: 0, buckets: boundaries.map(() => 0) };
      this.histograms.set(stage, value);
    }
    value.count++;
    value.sum += seconds;
    for (let i = 0; i < boundaries.length; i++) if (seconds <= boundaries[i]!) value.buckets[i]!++;
  }
  result(result: Result) {
    this.increment("claimlens_verdict_total", `{verdict="${result.verdict}"}`);
    this.increment("claimlens_cache_total", `{hit="${Boolean(result.cached)}"}`);
    for (const stage of result.trace || []) this.observe(stage.stage, stage.duration_ms / 1000);
  }
  render(queue: { active: number; queued: number }) {
    const lines = [
      "# HELP claimlens_stage_duration_seconds Server stage duration.",
      "# TYPE claimlens_stage_duration_seconds histogram",
    ];
    for (const [stage, value] of this.histograms) {
      boundaries.forEach((boundary, index) =>
        lines.push(
          `claimlens_stage_duration_seconds_bucket{stage="${stage}",le="${boundary}"} ${value.buckets[index]}`,
        ),
      );
      lines.push(
        `claimlens_stage_duration_seconds_bucket{stage="${stage}",le="+Inf"} ${value.count}`,
        `claimlens_stage_duration_seconds_sum{stage="${stage}"} ${value.sum}`,
        `claimlens_stage_duration_seconds_count{stage="${stage}"} ${value.count}`,
      );
    }
    for (const [key, value] of this.counters) lines.push(`${key} ${value}`);
    lines.push(
      `# TYPE claimlens_active_jobs gauge`,
      `claimlens_active_jobs ${queue.active}`,
      `# TYPE claimlens_queued_jobs gauge`,
      `claimlens_queued_jobs ${queue.queued}`,
    );
    return lines.join("\n") + "\n";
  }
}
