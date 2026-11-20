const frontendRequire = require("node:module").createRequire(require("node:path").join(__dirname, "apps/web/package.json"));
const unwrap = value => value.default || value;
const js = unwrap(frontendRequire("@eslint/js"));
const globals = unwrap(frontendRequire("globals"));
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
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
  {
    files: ["apps/api/src/**/*.ts", "packages/shared/src/**/*.ts"],
    languageOptions: { parser: tsParser, sourceType: "module", globals: globals.node },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: { ...js.configs.recommended.rules, "no-undef": "off", "no-unused-vars": "off", "no-empty": ["error", { allowEmptyCatch: true }], "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
];
