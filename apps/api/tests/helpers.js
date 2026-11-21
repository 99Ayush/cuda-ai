const { once } = require("node:events");
const { createApp } = require("../../../apps/api/dist/app.js");
const config = {
  geminiKey: "test",
  tavilyKey: "test",
  model: "test-model",
  allowedOrigins: [],
  production: false,
  vercel: false,
  rateLimit: 10,
  // Baseline fixtures exercise pipeline mechanics with one controlled source.
  // The two-independent-source abstention policy is covered by stages.test.cjs.
  minimumSources: 1,
};
const source = {
  title: "Lightning facts",
  url: "https://www.weather.gov/safety/lightning-myths",
  content:
    "Lightning often strikes the same place repeatedly, especially if it is a tall, pointy, isolated object.",
  published_date: "2026-01-01",
};
function modelOutput(overrides = {}) {
  return {
    claims: [
      {
        claim_index: 0,
        claim_kind: "FACTUAL",
        verdict: "FALSE",
        explanation: "Lightning can repeatedly strike the same location, contrary to the claim.",
        evidence: [{ source_id: "1-1", quote: source.content, stance: "REFUTES" }],
        ...overrides,
      },
    ],
  };
}
function providers(overrides = {}) {
  return {
    search: async () => [source],
    extract: async () => "An article asserting that lightning never strikes the same place twice.",
    generate: async (task) =>
      task.startsWith("Extract")
        ? { claims: ["Lightning never strikes the same place twice."] }
        : modelOutput(),
    ...overrides,
  };
}
async function server(t, options = {}) {
  const app = createApp({ config, providers: providers(), ...options });
  const listener = app.listen(0, "127.0.0.1");
  await once(listener, "listening");
  t.after(async () => {
    listener.closeAllConnections();
    await new Promise((resolve) => listener.close(resolve));
  });
  return `http://127.0.0.1:${listener.address().port}`;
}
module.exports = { config, source, providers, modelOutput, server };
