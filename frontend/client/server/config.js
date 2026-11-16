const path = require("node:path");
const dotenv = require("dotenv");

function loadConfig(env = process.env) {
  if (env === process.env) {
    dotenv.config({
      path: [
        path.resolve(__dirname, "../../../.env"),
        path.resolve(__dirname, "../../../backend/api/.env"),
        path.resolve(__dirname, "../.env"),
      ],
      quiet: true,
    });
  }
  const clean = (value) => (value || "").trim().replace(/^["']|["']$/g, "");
  return {
    geminiKey: clean(env.GEMINI_API_KEY),
    tavilyKey: clean(env.TAVILY_API_KEY),
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
