const path = require("node:path");
const dotenv = require("dotenv");

function loadConfig(env = process.env) {
  if (env === process.env) {
    dotenv.config({
      path: [
        path.resolve(__dirname, "../../../.env"),
        path.resolve(__dirname, "../../../apps/api/.env"),
        path.resolve(__dirname, "../.env"),
      ],
      quiet: true,
    });
  }
  const clean = (value) => (value || "").trim().replace(/^["']|["']$/g, "");
  return {
    geminiKey: clean(env.GEMINI_API_KEY),
    tavilyKey: clean(env.TAVILY_API_KEY),
    googleKey: env.GOOGLE_SEARCH_ENABLED === "false" ? "" : clean(env.GOOGLE_SEARCH_API_KEY),
    fallbackModel: clean(env.GEMINI_FALLBACK_MODEL) || "gemini-3.1-flash-lite",
    backupModel: clean(env.GEMINI_BACKUP_MODEL) || "gemini-2.5-flash",
    googleEngineId: clean(env.GOOGLE_SEARCH_ENGINE_ID),
    model: clean(env.GEMINI_MODEL) || "gemini-3.5-flash-lite",
    allowedOrigins: (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    production: env.NODE_ENV === "production" || env.VERCEL === "1",
    vercel: env.VERCEL === "1",
    rateLimit: 10,
  };
}
module.exports = { loadConfig };
