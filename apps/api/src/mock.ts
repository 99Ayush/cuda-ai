import { setTimeout as delay } from "node:timers/promises";
import type { Providers } from "./types";
import { ServiceError } from "./errors";
export function createMockProviders(options: { delayMs?: number } = {}): Providers {
  return {
    async search(query, _excluded, signal) {
      await delay(options.delayMs ?? 30, undefined, { signal });
      if (query.includes("slow check")) await delay(15000, undefined, { signal });
      if (query.includes("provider unavailable"))
        throw new ServiceError(503, "PROVIDER_FAILURE", "Simulated provider outage.");
      if (query.includes("provider quota"))
        throw new ServiceError(503, "PROVIDER_QUOTA", "Simulated provider quota.");
      if (query.includes("no evidence")) return [];
      return [
        {
          url: "https://weather.gov/safety/lightning-myths",
          title: "Controlled demo weather source",
          content:
            "Lightning often strikes the same place repeatedly. Pure water boils at 100 degrees Celsius at standard atmospheric pressure.",
          provider: "Demo fixture",
          published_date: new Date().toISOString(),
        },
        {
          url: "https://bom.gov.au/weather-services",
          title: "Controlled demo corroboration",
          content:
            "Lightning can strike the same location many times. Water boils at 100 degrees Celsius at sea level; pressure changes the boiling point.",
          provider: "Demo fixture",
          published_date: new Date().toISOString(),
        },
      ];
    },
    async extract(url, signal) {
      await delay(30, undefined, { signal });
      if (url.includes("unreadable"))
        throw new ServiceError(422, "ARTICLE_UNREADABLE", "Simulated unreadable article.");
      return url.includes("opinion")
        ? "A fictional article without factual claims."
        : "Lightning never strikes the same place twice.";
    },
    async generate(task, data, _schema, signal, image) {
      await delay(options.delayMs ?? 30, undefined, { signal });
      if (image)
        return {
          text: "Lightning never strikes the same place twice.",
          claims: ["Lightning never strikes the same place twice."],
        };
      if (task.startsWith("Extract"))
        return {
          claims: JSON.stringify(data).includes("without factual claims")
            ? []
            : ["Lightning never strikes the same place twice."],
        };
      const supplied = data as {
        claims: {
          claim_index: number;
          claim: string;
          sources: { id: string; excerpts: { id: string; quote: string }[] }[];
        }[];
      };
      return {
        claims: (supplied.claims || []).map((item) => ({
          claim_index: item.claim_index,
          claim_kind: "FACTUAL",
          verdict: /lightning|always|never/i.test(item.claim) ? "FALSE" : "UNVERIFIED",
          explanation:
            "This is a controlled demonstration response. It verifies the application workflow, not the factual accuracy of arbitrary claims.",
          confidence: 0.5,
          evidence: item.sources.slice(0, 2).map((source) => ({
            source_id: source.id,
            excerpt_id: source.excerpts[0]?.id,
            stance: "REFUTES",
          })),
        })),
      };
    },
    usage: () => ({
      search_calls: 0,
      llm_calls: 0,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
    }),
  };
}
