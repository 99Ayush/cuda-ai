const { loadConfig } = require("../apps/api/src/config.js");
const { createProviders } = require("../apps/api/src/providers.js");
const { createEngine } = require("../apps/api/src/engine.js");
const config = loadConfig();
const transport = async (url, options) => {
  try {
    const response = await fetch(url, options);
    console.log(JSON.stringify({ provider_host: new URL(url).hostname, status: response.status }));
    if (!response.ok) {
      const data = await response.clone().json().catch(() => ({}));
      let message = String(data.error?.message || data.message || "").slice(0, 600);
      for (const secret of [config.geminiKey, config.tavilyKey, config.googleKey]) if (secret) message = message.split(secret).join("[redacted]");
      console.log(JSON.stringify({ upstream_code: data.error?.status, message }));
    }
    return response;
  } catch (error) {
    console.log(JSON.stringify({ provider_host: new URL(url).hostname, network_error: error.cause?.code || error.name }));
    throw error;
  }
};
const provider = createProviders(config, transport);
const originalGenerate = provider.generate;
provider.generate = async (...args) => {
  const output = await originalGenerate(...args);
  if (process.argv.includes("--debug")) console.log(JSON.stringify({ model: output._model, findings: output.claims }));
  return output;
};
createEngine(config, provider)({ text: process.argv[2] || "World War I began in 1914." }).then(result => console.log(JSON.stringify({ verdict: result.verdict, summary: result.summary, warnings: result.warnings })), error => { console.error(error.code, error.message); process.exitCode = 1; });
