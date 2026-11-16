const { createApp } = require("../../frontend/client/server/app.js");
const app = createApp();
if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a valid TCP port.");
  const server = app.listen(port, () =>
    console.log(`CUDA AI is listening on http://localhost:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
module.exports = app;
