const { setTimeout: delay } = require("node:timers/promises");
const { createApp } = require("../apps/api/dist/app.js");
if (!process.argv.includes("--fixtures")) {
  throw new Error("Simulation requires --fixtures. Use npm start for real fact checking.");
}

// Local-only provider responses. This is never loaded by the production server.
const lightning = {
  title: "Lightning myths — test fixture",
  url: "https://www.weather.gov/safety/lightning-myths",
  content:
    "Lightning often strikes the same place repeatedly, especially if it is a tall, pointy, isolated object.",
};
const water = {
  title: "Water boiling point — test fixture",
  url: "https://www.usgs.gov/water-science-school/science/water-properties-information-topic",
  content:
    "At standard atmospheric pressure, pure water boils at 100 degrees Celsius. The boiling point changes with pressure.",
};
async function transport(endpoint, options) {
  const body = JSON.parse(options.body);
  await delay(300, undefined, { signal: options.signal });
  if (endpoint.endsWith("/search")) {
    if (body.query.includes("slow check"))
      await delay(15000, undefined, { signal: options.signal });
    if (body.query.includes("provider unavailable"))
      return new Response("fixture outage", { status: 503 });
    if (body.query.includes("provider quota"))
      return new Response("fixture quota", { status: 429 });
    return Response.json({
      results: body.query.includes("no evidence")
        ? []
        : [body.query.includes("water") ? water : lightning],
    });
  }
  if (endpoint.endsWith("/extract")) {
    if (body.urls[0].includes("unreadable")) return Response.json({ results: [] });
    return Response.json({
      results: [
        {
          url: body.urls[0],
          raw_content: body.urls[0].includes("opinion")
            ? "This is an opinion essay with no verifiable factual assertions."
            : "Lightning never strikes the same place twice. Pure water boils at 100 degrees Celsius at standard atmospheric pressure.",
        },
      ],
    });
  }
  const data = JSON.parse(body.contents[0].parts[0].text);
  let output;
  if (data.article_text) {
    output = {
      claims: data.article_url.includes("opinion")
        ? []
        : [
            "Lightning never strikes the same place twice.",
            "Pure water boils at 100 degrees Celsius at standard atmospheric pressure.",
          ],
    };
  } else {
    output = {
      claims: data.claims.map((row) => {
        const source = row.sources[0];
        const supported = row.claim.includes("water");
        return {
          claim_index: row.claim_index,
          verdict: source ? (supported ? "TRUE" : "FALSE") : "UNVERIFIED",
          explanation: source
            ? supported
              ? "The retrieved test excerpt supports water boiling at 100 degrees Celsius at standard pressure."
              : "The retrieved test excerpt states that lightning can strike the same place repeatedly."
            : "No evidence was available for this claim in the controlled test.",
          evidence: source
            ? [
                {
                  source_id: source.id,
                  quote: source.content,
                  stance: supported ? "SUPPORTS" : "REFUTES",
                },
              ]
            : [],
        };
      }),
    };
  }
  return Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(output) }] },
      },
    ],
  });
}
const config = {
  geminiKey: "local-fixture",
  tavilyKey: "local-fixture",
  model: "provider-fixture",
  allowedOrigins: [],
  production: true,
  vercel: false,
  rateLimit: 100,
};
const server = createApp({ config, transport, testMode: true }).listen(18089, "127.0.0.1", () =>
  console.log(
    "SIMULATION http://127.0.0.1:18089 — controlled provider fixtures, no live API calls",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => server.close(() => process.exit(0)));
