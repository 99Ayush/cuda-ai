import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";
import { VERITY_EXTENSION_ID } from "@verity/shared";

const integer = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);
const Model = z.string().regex(/^[a-zA-Z0-9_.-]+$/);
const Origin = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}, "Use a service origin without a path");
export const ConfigSchema = z.object({
  geminiKey: z.string().default(""),
  tavilyKey: z.string().default(""),
  pubmedEnabled: z.boolean().default(false),
  wikidataEnabled: z.boolean().default(false),
  wikidataContactEmail: z.string().default("contact-email"),
  model: Model.default("gemini-3.5-flash-lite"),
  fallbackModel: Model.default("gemini-3.1-flash-lite"),
  backupModel: Model.default("gemini-2.5-flash"),
  allowedOrigins: z.array(Origin).default([]),
  allowedExtensionIds: z.array(z.string().regex(/^[a-p]{32}$/)).default([VERITY_EXTENSION_ID]),
  production: z.boolean().default(false),
  vercel: z.boolean().default(false),
  demo: z.boolean().default(false),
  clientKeys: z.array(z.string().min(16)).default([]),
  rateLimit: integer(10, 1, 1000),
  concurrency: integer(4, 1, 64),
  queueSize: integer(20, 0, 1000),
  timeoutMs: integer(90000, 100, 120000),
  providerTimeoutMs: integer(30000, 100, 60000),
  cacheTtlMs: integer(600000, 0, 86400000),
  cacheSize: integer(0, 0, 10000),
  freshnessMs: integer(604800000, 1000, 31536000000),
  minimumSources: integer(2, 1, 6),
  maxQueries: integer(3, 2, 4),
  maxProviderCalls: integer(1000, 1, 100000),
  maxCostUsd: z.coerce.number().nonnegative().default(5),
  inputPricePerMillion: z.coerce.number().nonnegative().optional(),
  outputPricePerMillion: z.coerce.number().nonnegative().optional(),
  databaseUrl: z.string().default(""),
  databasePath: z.string().default("data/verity.sqlite"),
  persistenceEnabled: z.boolean().default(false),
  stage: z.enum(["development", "staging", "production"]).default("development"),
});
export type Config = z.infer<typeof ConfigSchema>;
export type EngineConfig = Pick<Config, "geminiKey" | "tavilyKey" | "model"> & Partial<Config>;
function boolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (!["true", "false"].includes(value))
    throw new Error("Boolean environment values must be true or false");
  return value === "true";
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env)
    dotenv.config({
      path: [
        path.resolve(__dirname, "../../../.env.local"),
        path.resolve(__dirname, "../../../.env"),
        path.resolve(__dirname, "../.env.local"),
        path.resolve(__dirname, "../.env"),
        path.resolve(__dirname, "../../web/.env"),
      ],
      quiet: true,
    });
  const clean = (value?: string) => (value || "").trim().replace(/^["']|["']$/g, "");
  const result = ConfigSchema.safeParse({
    geminiKey: clean(env.GEMINI_API_KEY),
    tavilyKey: clean(env.TAVILY_API_KEY),
    pubmedEnabled: boolean(env.PUBMED_ENABLED, true),
    wikidataEnabled: boolean(env.WIKIDATA_ENABLED, true),
    wikidataContactEmail: clean(env.WIKIDATA_CONTACT_EMAIL) || undefined,
    model: clean(env.GEMINI_MODEL) || undefined,
    fallbackModel: clean(env.GEMINI_FALLBACK_MODEL) || undefined,
    backupModel: clean(env.GEMINI_BACKUP_MODEL) || undefined,
    allowedOrigins: (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowedExtensionIds: env.ALLOWED_EXTENSION_IDS
      ? env.ALLOWED_EXTENSION_IDS.split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
    production: env.NODE_ENV === "production" || env.VERCEL === "1",
    vercel: env.VERCEL === "1",
    demo: boolean(env.DEMO_MODE),
    clientKeys: (env.CLIENT_API_KEYS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    rateLimit: env.RATE_LIMIT,
    concurrency: env.MAX_CONCURRENCY,
    queueSize: env.MAX_QUEUE_SIZE,
    timeoutMs: env.CHECK_TIMEOUT_MS,
    providerTimeoutMs: env.PROVIDER_TIMEOUT_MS,
    cacheTtlMs: env.CACHE_TTL_MS,
    cacheSize: env.CACHE_SIZE,
    freshnessMs: env.EVIDENCE_FRESHNESS_MS,
    minimumSources: env.MINIMUM_SOURCES,
    maxQueries: env.SEARCH_QUERIES,
    maxProviderCalls: env.MAX_PROVIDER_CALLS,
    maxCostUsd: env.MAX_COST_USD,
    inputPricePerMillion: env.INPUT_PRICE_PER_MILLION,
    outputPricePerMillion: env.OUTPUT_PRICE_PER_MILLION,
    databaseUrl: env.DATABASE_URL || "",
    databasePath: env.DATABASE_PATH || "data/verity.sqlite",
    persistenceEnabled: boolean(env.PERSISTENCE_ENABLED),
    stage: env.APP_ENV || "development",
  });
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  return result.data;
}
export function resolveConfig(config: EngineConfig): Config {
  return ConfigSchema.parse(config);
}
