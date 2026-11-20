const frontendRequire = require("node:module").createRequire(require("node:path").join(__dirname, "frontend/client/package.json"));
const unwrap = value => value.default || value;
const js = unwrap(frontendRequire("@eslint/js"));
const globals = unwrap(frontendRequire("globals"));
module.exports = [
  { ignores: ["node_modules/**", "frontend/**"] },
  {
    files: ["extension/*.js"],
    ...js.configs.recommended,
    languageOptions: { sourceType: "script", globals: { ...globals.browser, chrome: "readonly" } },
  },
  {
    files: ["scripts/*.js", "backend/**/*.js", "api/*.js", "eslint.config.js"],
    ...js.configs.recommended,
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
];
