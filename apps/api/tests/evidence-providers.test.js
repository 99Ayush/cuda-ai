const test = require("node:test");
const assert = require("node:assert/strict");
const { createProviders } = require("../dist/providers.js");
const { config } = require("./helpers.js");
const { loadConfig } = require("../dist/config.js");

test("legacy provider credentials cannot reactivate removed evidence sources", async () => {
 const calls=[];const providers=createProviders({...config,googleKey:"legacy-google",braveKey:"legacy-brave"},async endpoint=>{calls.push(endpoint);return Response.json({results:[{url:"https://example.org/evidence",content:"A usable original excerpt."}]});});
 const results=await providers.search("a factual claim",[],AbortSignal.timeout(3000));
 assert.equal(calls.length,1);assert.match(calls[0],/api.tavily.com/);assert.equal(results[0].provider,"Tavily");assert.doesNotMatch(JSON.stringify(results),/legacy-google|legacy-brave/);
});

test("removed providers do not satisfy the required web evidence configuration", async()=>{
 const {createEngine}=require("../dist/engine.js");const {providers:fixtureProviders}=require("./helpers.js");
 const engine=createEngine({...config,tavilyKey:"",googleKey:"legacy-google",braveKey:"legacy-brave"},fixtureProviders());
 await assert.rejects(()=>engine({text:"Earth orbits the Sun."}),error=>error.code==="SETUP_REQUIRED");
});

test("PubMed retrieves abstracts for health claims and excludes retracted publications", async () => {
  const calls = [];
  const providers = createProviders({ ...config, pubmedEnabled: true }, async (url) => {
    calls.push(url);
    if (url.includes("tavily")) return Response.json({ results: [] });
    if (url.includes("esearch"))
      return Response.json({ esearchresult: { idlist: ["123", "124"] } });
    return new Response(`<PubmedArticleSet>
      <PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>Controlled vaccine review</ArticleTitle><Journal><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue></Journal><Abstract><AbstractText Label="RESULTS">The review found evidence from randomised trials.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle>
      <PubmedArticle><MedlineCitation><PMID>124</PMID><Article><ArticleTitle>Retracted paper</ArticleTitle><Abstract><AbstractText>Unsupported claims from a retracted paper.</AbstractText></Abstract><PublicationTypeList><PublicationType>Retracted Publication</PublicationType></PublicationTypeList></Article></MedlineCitation></PubmedArticle>
    </PubmedArticleSet>`);
  });
  const results = await providers.search("vaccine health evidence", [], AbortSignal.timeout(4000));
  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "PubMed");
  assert.equal(results[0].url, "https://pubmed.ncbi.nlm.nih.gov/123/");
  assert.match(results[0].content, /randomised trials/);
  assert.doesNotMatch(results[0].content, /retracted paper/);
  calls.length = 0;
  await providers.search("water boils at sea level", [], AbortSignal.timeout(3000));
  assert.equal(calls.length, 1);
});

test("Wikidata supplies entity labels and structured statements, ignoring deprecated values", async () => {
  let wikiCalls = 0;
  const providers = createProviders(
    { ...config, wikidataEnabled: true, wikidataContactEmail: "test@example.org" },
    async (endpoint, options) => {
      const url = new URL(endpoint);
      if (endpoint.includes("tavily")) return Response.json({ results: [] });
      wikiCalls++;
      assert.equal(options.headers["User-Agent"], "Verity/1.0 (test@example.org)");
      if (url.searchParams.get("action") === "wbsearchentities")
        return Response.json({ search: [{ id: "Q937", label: "Albert Einstein" }] });
      if (url.searchParams.get("props") === "labels")
        return Response.json({ entities: { Q5: { labels: { en: { value: "human" } } } } });
      assert.match(endpoint, /Special:EntityData\/Q937\.json$/);
      return Response.json({
        entities: {
          Q937: {
            labels: { en: { value: "Albert Einstein" } },
            descriptions: { en: { value: "theoretical physicist" } },
            claims: {
              P31: [{ rank: "normal", mainsnak: { datavalue: { value: { id: "Q5" } } } }],
              P569: [
                {
                  rank: "normal",
                  mainsnak: { datavalue: { value: { time: "+1879-03-14T00:00:00Z" } } },
                },
                {
                  rank: "deprecated",
                  mainsnak: { datavalue: { value: { time: "+9999-01-01T00:00:00Z" } } },
                },
              ],
            },
          },
        },
      });
    },
  );
  const results = await providers.search(
    "Albert Einstein birth date",
    [],
    AbortSignal.timeout(3000),
  );
  assert.equal(results[0].provider, "Wikidata");
  assert.match(results[0].content, /Birth date: 1879-03-14/);
  assert.match(results[0].content, /Instance of: human/);
  assert.doesNotMatch(results[0].content, /9999/);
  const initialCalls = wikiCalls;
  const cached = await providers.search(
    "Albert Einstein birth date",
    [],
    AbortSignal.timeout(3000),
  );
  assert.equal(wikiCalls, initialCalls);
  assert.equal(cached[0].content, results[0].content);
});

test("removed credential environment variables are ignored by configuration",()=>{
 const loaded=loadConfig({FACTCHECK_API_KEY:"legacy-google",GOOGLE_SEARCH_API_KEY:"legacy-google",BRAVE_SEARCH_API_KEY:"legacy-brave",WIKIDATA_CONTACT_EMAIL:"test@example.org"});
 assert.equal(loaded.googleKey,undefined);assert.equal(loaded.braveKey,undefined);assert.equal(loaded.wikidataContactEmail,"test@example.org");
});

test("Wikidata disambiguates a cached name using the claim context", async () => {
  let searches = 0;
  const facts = [];
  const providers = createProviders({ ...config, wikidataEnabled: true }, async (endpoint) => {
    if (endpoint.includes("tavily")) return Response.json({ results: [] });
    const url = new URL(endpoint);
    if (url.searchParams.get("action") === "wbsearchentities") {
      searches++;
      return Response.json({
        search: [
          {
            id: "Q14647",
            label: "Sun Microsystems",
            description: "American software company",
            aliases: ["Sun"],
          },
          { id: "Q525", label: "Sun", description: "star at the centre of the Solar System" },
        ],
      });
    }
    const id = endpoint.includes("Q14647") ? "Q14647" : "Q525";
    facts.push(id);
    return Response.json({
      entities: {
        [id]: {
          labels: { en: { value: id === "Q525" ? "Sun" : "Sun Microsystems" } },
          descriptions: {
            en: {
              value:
                id === "Q525"
                  ? "star at the centre of the Solar System"
                  : "American software company",
            },
          },
        },
      },
    });
  });
  const astronomy = await providers.search("The Sun is a planet", [], AbortSignal.timeout(3000));
  assert.equal(astronomy[0].url, "https://www.wikidata.org/wiki/Q525");
  const company = await providers.search("The Sun software company", [], AbortSignal.timeout(3000));
  assert.equal(company[0].url, "https://www.wikidata.org/wiki/Q14647");
  assert.equal(searches, 1);
  assert.deepEqual(facts, ["Q525", "Q14647"]);
});

test("Wikidata empty entity matches are cached and remain a supporting signal", async () => {
  let calls = 0;
  const providers = createProviders({ ...config, wikidataEnabled: true }, async (url) => {
    if (url.includes("tavily"))
      return Response.json({
        results: [
          { url: "https://example.org/evidence", content: "Original independent evidence." },
        ],
      });
    calls++;
    return Response.json({ search: [] });
  });
  for (let i = 0; i < 2; i++) {
    const result = await providers.search(
      "UnresolvedName is a city",
      [],
      AbortSignal.timeout(3000),
    );
    assert.equal(result[0].provider, "Tavily");
  }
  assert.equal(calls, 1);
});

test("a supporting Wikidata outage preserves Tavily evidence without exposing response bodies",async()=>{
 const providers=createProviders({...config,wikidataEnabled:true},async endpoint=>endpoint.includes("tavily")?Response.json({results:[{url:"https://example.org/evidence",content:"Original excerpt."}]}):new Response("sensitive-provider-response",{status:429}));
 const results=await providers.search("The Sun is a planet",[],AbortSignal.timeout(3000));
 assert.equal(results[0].provider,"Tavily");assert.match(results.warnings[0],/Wikidata/);assert.doesNotMatch(JSON.stringify(results),/sensitive-provider-response/);
});

