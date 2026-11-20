module.exports = async () => {
  const [{ defineConfig }, { default: react }] = await Promise.all([
    import("vite"),
    import("@vitejs/plugin-react"),
  ]);
  return defineConfig({
    plugins: [react()],
    resolve: { alias: { "@claimlens/shared": require("node:path").resolve(__dirname, "../../packages/shared/src/index.ts") } },
    server: { proxy: { "/api": "http://127.0.0.1:8080" } },
  });
};
