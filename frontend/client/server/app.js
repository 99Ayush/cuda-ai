const express = require("express");
const { rateLimit } = require("express-rate-limit");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { loadConfig } = require("./config.js");
const { createProviders } = require("./providers.js");
const { createEngine } = require("./engine.js");
const { ServiceError } = require("./errors.js");

function createApp(options = {}) {
  const config = options.config || loadConfig();
  const providers =
    options.providers || createProviders(config, options.transport);
  const analyze = options.analyze || createEngine(config, providers);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.vercel ? 1 : false);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    if (config.production)
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' " +
          config.allowedOrigins.join(" ") +
          "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    if (
      req.path.startsWith("/api") ||
      ["/health", "/history", "/analyze-claim"].includes(req.path)
    )
      res.set("Cache-Control", "no-store");
    const origin = req.get("origin");
    if (origin) {
      const ownOrigin = `${req.protocol}://${req.get("host")}`;
      if (origin !== ownOrigin && !config.allowedOrigins.includes(origin))
        return next(
          new ServiceError(
            403,
            "ORIGIN_BLOCKED",
            "Requests from this website are not allowed.",
          ),
        );
      res.set("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  // Query routing keeps the same handler usable in Vercel's Vite deployment.
  app.use((req, res, next) => {
    if (
      req.path === "/api" &&
      typeof req.query.route === "string" &&
      /^[a-z-]+$/.test(req.query.route)
    )
      req.url = `/api/${req.query.route}`;
    next();
  });
  const limiter = rateLimit({
    windowMs: 60000,
    limit: config.rateLimit || 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: { xForwardedForHeader: config.vercel },
    handler: (req, res) =>
      res
        .status(429)
        .json({
          error: "RATE_LIMITED",
          message:
            "You have made several checks recently. Please wait a minute before trying again.",
          request_id: req.requestId,
        }),
  });
  app.get(["/api/health", "/health"], (req, res) =>
    res.json({
      status: config.geminiKey && config.tavilyKey ? "ready" : "setup_required",
      configured: {
        evidence: !!config.tavilyKey,
        analysis: !!config.geminiKey,
      },
      history: "browser",
      version: "3.0.0",
      test_mode: options.testMode === true,
    }),
  );
  app.post(
    ["/api/analyze-claim", "/analyze-claim"],
    limiter,
    async (req, res, next) => {
      try {
        res.json(await analyze(req.body));
      } catch (error) {
        next(error);
      }
    },
  );
  // Compatibility only. User claims are never retained in a global server history.
  app.get(["/api/history", "/history"], (req, res) => res.json([]));
  app.use("/api", (req, res) =>
    res
      .status(404)
      .json({
        error: "NOT_FOUND",
        message: "This API endpoint does not exist.",
      }),
  );
  const dist = path.resolve(__dirname, "../dist");
  if (!config.vercel && fs.existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist));
    app.get("/", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.use((req, res) =>
    res
      .status(404)
      .json({ error: "NOT_FOUND", message: "This page does not exist." }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let failure = error;
    if (error.type === "entity.parse.failed")
      failure = new ServiceError(
        400,
        "INVALID_JSON",
        "Send a valid JSON request.",
      );
    if (error.type === "entity.too.large")
      failure = new ServiceError(
        413,
        "INPUT_TOO_LARGE",
        "This input is too long. Use a shorter claim or an article URL.",
      );
    const known = failure instanceof ServiceError;
    if (!known)
      console.error(
        JSON.stringify({
          event: "request_failed",
          request_id: req.requestId,
          code: "INTERNAL_ERROR",
        }),
      );
    res
      .status(known ? failure.status : 500)
      .json({
        error: known ? failure.code : "INTERNAL_ERROR",
        message: known
          ? failure.message
          : "The check could not be completed. Please try again.",
        request_id: req.requestId,
      });
  });
  return app;
}
module.exports = { createApp };
