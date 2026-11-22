import { z } from "zod";
import { JSDOM } from "jsdom";
import type { Config } from "./config";
import type { SearchResult } from "./types";

type GetJson = (name: string, url: URL, headers?: Record<string, string>) => Promise<unknown>;
type GetText = (name: string, url: URL) => Promise<string>;
export type EvidenceJob = { name: string; search: () => Promise<SearchResult[]> };
export type WikidataCache = Map<
  string,
  { expires: number; results: SearchResult[]; entries?: z.infer<typeof EntitySearch>["search"] }
>;
const Biomedical =
  /\b(health|medical|vaccine|cancer|disease|vitamin|diabet\w*|drug|medicine|treatment|virus|covid|heart|brain|diet|blood|antibiotic|clinical|nutrition|supplement)\b/i;
const EntitySearch = z.object({
  search: z.array(
    z.object({
      id: z.string().regex(/^Q\d+$/),
      label: z.string(),
      description: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      match: z.object({ text: z.string() }).optional(),
    }),
  ),
});
const Entities = z.object({
  entities: z.record(
    z.string(),
    z.object({
      labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
      descriptions: z.record(z.string(), z.object({ value: z.string() })).optional(),
      claims: z
        .record(
          z.string(),
          z.array(
            z.object({
              rank: z.string().optional(),
              mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }),
            }),
          ),
        )
        .optional(),
    }),
  ),
});
const Properties: Record<string, string> = {
  P31: "Instance of",
  P279: "Subclass of",
  P569: "Birth date",
  P570: "Death date",
  P571: "Inception",
  P17: "Country",
  P19: "Birthplace",
  P20: "Place of death",
  P112: "Founder",
  P61: "Discoverer",
  P361: "Part of",
  P1376: "Capital of",
  P2048: "Height",
  P1082: "Population",
};
function entityTerms(query: string): string[] {
  const phrases = query.match(/\b[A-Z][\p{L}\d'-]*(?:\s+[A-Z][\p{L}\d'-]*){0,3}/gu) || [];
  return [
    ...new Set(
      phrases
        .map((term) => term.replace(/^(The|A|An|Is|Are|Does|Did|Can|What|Where|When|How)\s+/, ""))
        .filter(
          (term) =>
            !/^(The|A|An|Is|Are|Does|Did|Can|What|Where|When|How|Claim|Evidence|Scientific|Fact)$/i.test(
              term,
            ),
        ),
    ),
  ].slice(0, 2);
}
function wikiUrl(action: string, values: Record<string, string>) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  for (const [key, value] of Object.entries({ action, format: "json", ...values }))
    url.searchParams.set(key, value);
  return url;
}
function selectEntity(
  entries: z.infer<typeof EntitySearch>["search"],
  term: string,
  query: string,
) {
  const name = term.toLowerCase();
  const words = new Set(query.toLowerCase().match(/[a-z]{3,}/g) || []);
  function score(item: (typeof entries)[number]) {
    const description = (item.description || "").toLowerCase();
    let value = item.label.toLowerCase() === name ? 50 : 0;
    if (
      item.match?.text.toLowerCase() === name ||
      item.aliases?.some((alias) => alias.toLowerCase() === name)
    )
      value += 30;
    value += (description.match(/[a-z]{3,}/g) || []).filter((word) => words.has(word)).length * 4;
    if (/\b(planet|star|solar|orbit|astronomy)\b/i.test(query))
      value += /\b(star|planet|solar|celestial|astronomical)\b/.test(description) ? 25 : -15;
    if (/\b(company|software|computer|technology)\b/i.test(query))
      value += /\b(company|software|computer|technology)\b/.test(description) ? 25 : -15;
    return value;
  }
  const ranked = [...entries].sort((a, b) => score(b) - score(a));
  return ranked[0] && score(ranked[0]) > 0 ? [ranked[0]] : [];
}
export function evidenceJobs(
  config: Config,
  query: string,
  json: GetJson,
  text: GetText,
  wikiCache: WikidataCache = new Map(),
): EvidenceJob[] {
  const jobs: EvidenceJob[] = [];
  if (config.pubmedEnabled && Biomedical.test(query))
    jobs.push({
      name: "PubMed",
      search: async () => {
        const search = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
        for (const [key, value] of Object.entries({
          db: "pubmed",
          retmode: "json",
          retmax: "3",
          term: query.slice(0, 400),
          tool: "Verity",
        }))
          search.searchParams.set(key, value);
        const data = z
          .object({
            esearchresult: z.object({ idlist: z.array(z.string().regex(/^\d+$/)).max(3) }),
          })
          .parse(await json("PubMed", search));
        if (!data.esearchresult.idlist.length) return [];
        const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
        for (const [key, value] of Object.entries({
          db: "pubmed",
          retmode: "xml",
          id: data.esearchresult.idlist.join(","),
          tool: "Verity",
        }))
          url.searchParams.set(key, value);
        const dom = new JSDOM(await text("PubMed", url), { contentType: "application/xml" });
        try {
          return [...dom.window.document.querySelectorAll("PubmedArticle")].flatMap((article) => {
            if (
              [...article.querySelectorAll("PublicationType")].some((node) =>
                /retracted publication|retraction of publication/i.test(node.textContent || ""),
              )
            )
              return [];
            const id = article.querySelector("PMID")?.textContent?.trim();
            const title =
              article.querySelector("ArticleTitle")?.textContent?.trim() || "PubMed article";
            const abstract = [...article.querySelectorAll("AbstractText")]
              .map(
                (node) =>
                  `${node.getAttribute("Label") ? node.getAttribute("Label") + ": " : ""}${node.textContent || ""}`,
              )
              .join("\n")
              .trim();
            const year = article.querySelector("PubDate > Year")?.textContent;
            if (!id || !/^\d+$/.test(id) || !abstract) return [];
            return [
              {
                url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                title,
                content: `${title}\nPublication year: ${year || "unavailable"}.\n${abstract}`,
                provider: "PubMed",
              },
            ];
          });
        } finally {
          dom.window.close();
        }
      },
    });
  const terms = config.wikidataEnabled ? entityTerms(query) : [];
  if (terms.length)
    jobs.push({
      name: "Wikidata",
      search: async () => {
        function remember(
          key: string,
          results: SearchResult[],
          entries?: z.infer<typeof EntitySearch>["search"],
        ) {
          while (wikiCache.size >= 500 && !wikiCache.has(key)) {
            const first = wikiCache.keys().next().value;
            if (!first) break;
            wikiCache.delete(first);
          }
          wikiCache.set(key, { expires: Date.now() + 86400000, results, entries });
        }
        const candidateGroups = await Promise.all(
          terms.map(async (term) => {
            const key = term.toLocaleLowerCase();
            const hit = wikiCache.get(key);
            let entries = hit && hit.expires > Date.now() ? hit.entries : undefined;
            if (entries === undefined) {
              entries = EntitySearch.parse(
                await json(
                  "Wikidata",
                  wikiUrl("wbsearchentities", { search: term, language: "en", limit: "6" }),
                ),
              ).search;
              remember(key, [], entries);
            }
            return { term, entries: selectEntity(entries, term, query) };
          }),
        );
        const candidates = candidateGroups.flatMap((group) => group.entries);
        const cached: SearchResult[] = [];
        const ids = [...new Set(candidates.map((item) => item.id))].filter((id) => {
          const hit = wikiCache.get("qid:" + id);
          if (hit && hit.expires > Date.now()) {
            cached.push(...hit.results);
            return false;
          }
          return true;
        });
        if (!ids.length) return cached;
        const entityResponses = await Promise.all(
          ids.map(async (id) =>
            Entities.parse(
              await json(
                "Wikidata",
                new URL(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`),
              ),
            ),
          ),
        );
        const data = {
          entities: Object.assign(
            {},
            ...entityResponses.map((response) => response.entities),
          ) as z.infer<typeof Entities>["entities"],
        };
        const targets = [
          ...new Set(
            Object.values(data.entities).flatMap((entity) =>
              Object.entries(entity.claims || {})
                .filter(([property]) => property in Properties)
                .flatMap(([, claims]) =>
                  claims
                    .filter((claim) => claim.rank !== "deprecated")
                    .flatMap((claim) => {
                      const value = claim.mainsnak.datavalue?.value;
                      return value &&
                        typeof value === "object" &&
                        "id" in value &&
                        typeof value.id === "string" &&
                        /^Q\d+$/.test(value.id)
                        ? [value.id]
                        : [];
                    }),
                ),
            ),
          ),
        ].slice(0, 40);
        const labels = targets.length
          ? Entities.parse(
              await json(
                "Wikidata",
                wikiUrl("wbgetentities", {
                  ids: targets.join("|"),
                  props: "labels",
                  languages: "en",
                }),
              ),
            ).entities
          : {};
        function valueText(value: unknown): string {
          if (typeof value === "string") return value;
          if (!value || typeof value !== "object") return "";
          if ("id" in value && typeof value.id === "string")
            return labels[value.id]?.labels?.en?.value || "";
          if ("time" in value && typeof value.time === "string")
            return value.time.replace(/^\+/, "").split("T")[0] || "";
          if ("amount" in value && typeof value.amount === "string") return value.amount;
          return "";
        }
        const results = ids.flatMap((id) => {
          const entity = data.entities[id];
          if (!entity) return [];
          const title =
            entity.labels?.en?.value || candidates.find((item) => item.id === id)?.label || id;
          const description = entity.descriptions?.en?.value || "";
          const statements = Object.entries(entity.claims || {})
            .filter(([property]) => property in Properties)
            .flatMap(([property, claims]) =>
              claims
                .filter((claim) => claim.rank !== "deprecated")
                .slice(0, 3)
                .map((claim) => {
                  const value = valueText(claim.mainsnak.datavalue?.value);
                  return value ? `${Properties[property]}: ${value}.` : "";
                }),
            )
            .filter(Boolean);
          return description || statements.length
            ? [
                {
                  url: `https://www.wikidata.org/wiki/${id}`,
                  title,
                  content: `${title}: ${description}\n${statements.join("\n")}`,
                  provider: "Wikidata",
                },
              ]
            : [];
        });
        for (const id of ids)
          remember(
            "qid:" + id,
            results.filter((result) => result.url.endsWith("/" + id)),
          );
        return [...cached, ...results];
      },
    });
  return jobs;
}
