import { getDomain } from "tldts";
import type { Source, Finding } from "@verity/shared";
import reputation from "./source-quality.json";
import { publicUrl } from "./url";
import type { SearchResult } from "./types";
export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}
export function canonicalUrl(value: string): string | null {
  const safe = publicUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  url.hostname = url.hostname.replace(/^www\./, "");
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || ["fbclid", "gclid", "msclkid"].includes(key))
      url.searchParams.delete(key);
  url.searchParams.sort();
  url.hash = "";
  return url.href;
}
export function timeSensitive(claim: string): boolean {
  return /\b(today|tomorrow|currently|latest|now|recently|this (week|month|year)|as of)\b/i.test(
    claim,
  );
}
export function sourceExcerpts(content: string, id: string): { id: string; quote: string }[] {
  const excerpts: { id: string; quote: string }[] = [];
  for (const segment of content.match(/[^.!?\n]+[.!?]?/g) || []) {
    let text = segment.trim();
    while (text.length) {
      let end = Math.min(text.length, 550);
      if (text.length > end) {
        const space = text.lastIndexOf(" ", end);
        if (space > 100) end = space;
      }
      const quote = text.slice(0, end).trim();
      if (quote.length >= 15) excerpts.push({ id: `${id}:e${excerpts.length + 1}`, quote });
      text = text.slice(end).trim();
    }
  }
  return excerpts.slice(0, 30);
}
type Reputation = {
  tier: "primary" | "reference" | "news" | "other";
  owner: string;
  reason: string;
};
export function sourceQuality(
  url: string,
  date: string | null,
  now = Date.now(),
  freshnessMs = 604800000,
): NonNullable<Source["quality"]> {
  const domain = getDomain(url, { allowPrivateDomains: true }) || new URL(url).hostname;
  const rule = (reputation.domains as Record<string, Reputation>)[domain];
  const tier = rule?.tier || "other";
  const recent = date ? now - Date.parse(date) <= freshnessMs && Date.parse(date) <= now : null;
  const score = { primary: 0.9, reference: 0.7, news: 0.7, other: 0.4 }[tier];
  return {
    tier,
    score,
    independent_domain: rule?.owner || domain,
    recent,
    explanation: `${rule?.reason || "Domain has no maintained reputation entry"}. ${date ? (recent ? "Dated evidence is within the configured freshness window." : "Publication is outside the configured freshness window.") : "Publication date unavailable."} These are review signals, not a truth probability.`,
  };
}
export function normalizeSources(
  results: SearchResult[],
  index: number,
  articleUrl?: string,
  now = Date.now(),
  freshnessMs = 604800000,
): Source[] {
  const seen = new Set<string>();
  const excluded = articleUrl ? getDomain(articleUrl) : null;
  const sources: Source[] = [];
  for (const result of results.slice(0, 32)) {
    const url = typeof result?.url === "string" ? canonicalUrl(result.url) : null;
    const content = typeof result?.content === "string" ? result.content.trim().slice(0, 3500) : "";
    if (!url || seen.has(url) || content.length < 30 || (excluded && getDomain(url) === excluded))
      continue;
    seen.add(url);
    const id = `${index + 1}-${seen.size}`;
    const published =
      typeof result.published_date === "string" &&
      Number.isFinite(Date.parse(result.published_date))
        ? new Date(result.published_date).toISOString()
        : null;
    sources.push({
      id,
      url,
      title: result.title?.trim().slice(0, 250) || new URL(url).hostname,
      publisher: new URL(url).hostname.replace(/^www\./, ""),
      content,
      provider: result.provider || "Tavily",
      published_at: published,
      retrieved_at: new Date(now).toISOString(),
      excerpts: sourceExcerpts(content, id),
      quality: sourceQuality(url, published, now, freshnessMs),
    });
    if (sources.length === 8) break;
  }
  return sources;
}
export function calibrate(finding: Finding, sensitive: boolean, minimum = 2): Finding {
  if (finding.verdict === "UNVERIFIED") return finding;
  const byId = new Map(finding.sources.map((source) => [source.id, source]));
  const cited = finding.evidence
    .filter((item) => item.stance === "SUPPORTS" || item.stance === "REFUTES")
    .map((item) => byId.get(item.source_id))
    .filter((item): item is Source => Boolean(item));
  const domains = new Set(
    cited.map(
      (source) => source.quality?.independent_domain || getDomain(source.url) || source.publisher,
    ),
  );
  let reason = "";
  if (["OPINION", "PREDICTION"].includes(finding.claim_kind || ""))
    reason =
      "Subjective judgments and unresolved predictions cannot be established as factual outcomes.";
  else if (domains.size < minimum)
    reason = `The finding has fewer than ${minimum} independent cited sources. A repeated or copied publisher is not independent corroboration.`;
  else if (sensitive && !cited.some((source) => source.quality?.recent === true))
    reason =
      "This time-sensitive claim lacks dated evidence within the configured freshness window.";
  if (reason)
    return {
      ...finding,
      verdict: "UNVERIFIED",
      explanation: reason,
      evidence_strength: "Insufficient",
      confidence: null,
      confidence_explanation: "Abstained under the documented evidence policy.",
    };
  const supports = finding.evidence.some((item) => item.stance === "SUPPORTS"),
    refutes = finding.evidence.some((item) => item.stance === "REFUTES");
  return {
    ...finding,
    verdict: supports && refutes ? "MIXED" : finding.verdict,
    evidence_strength:
      supports && refutes ? "Conflicting independent evidence" : "Multiple independent sources",
    confidence_explanation:
      "Model-reported confidence is an uncalibrated estimate, not a measured probability. Source quality signals remain visible separately.",
  };
}
