import type { Health } from "@claimlens/shared";
export function evidenceProviders(health: Health) {
  const configured = health.configured;
  return [
    {
      name: "Tavily",
      enabled: configured?.tavily ?? configured?.evidence ?? false,
      detail: "Web evidence",
      missing: "Key needed",
    },
    {
      name: "PubMed",
      enabled: configured?.pubmed ?? false,
      detail: "Health and medical claims",
      missing: "Disabled",
    },
    {
      name: "Wikidata",
      enabled: configured?.wikidata ?? false,
      detail: "Named entities and structured facts",
      missing: "Disabled",
    },
  ];
}
