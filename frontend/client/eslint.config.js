const unwrap = (value) => value.default || value;
const js = unwrap(require("@eslint/js"));
const globals = unwrap(require("globals"));
const reactHooks = unwrap(require("eslint-plugin-react-hooks"));
const reactRefresh = unwrap(require("eslint-plugin-react-refresh"));
const { defineConfig, globalIgnores } = require("eslint/config");
module.exports = defineConfig([
  globalIgnores(["dist", "node_modules"]),
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: [
      "server/**/*.js",
      "api/**/*.js",
      "vite.config.js",
      "eslint.config.js",
    ],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
  },
  {
    files: ["public/background.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly" } },
  },
]);
