const unwrap = (value) => value.default || value;
const js = unwrap(require("@eslint/js"));
const globals = unwrap(require("globals"));
const reactHooks = unwrap(require("eslint-plugin-react-hooks"));
const reactRefresh = unwrap(require("eslint-plugin-react-refresh"));
const { defineConfig, globalIgnores } = require("eslint/config");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
module.exports = defineConfig([
  globalIgnores(["dist", "node_modules", "public/verity-extension"]),
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      sourceType: "module",
      parser: tsParser,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: [
      "server/**/*.js",
      "scripts/**/*.js",
      "api/**/*.js",
      "vite.config.js",
      "eslint.config.js",
    ],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
  },
  {
    files: ["extension/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, chrome: "readonly" } },
  },
]);
