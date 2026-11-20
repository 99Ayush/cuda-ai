const { spawn } = require("node:child_process");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const client = path.join(root, "apps/web");
const resolve = createRequire(path.join(client, "package.json")).resolve;
const vite = path.join(
  path.dirname(resolve("vite/package.json")),
  "bin/vite.js",
);
const children = [
  spawn(process.execPath, ["--watch", "apps/api/index.js"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  }),
  spawn(process.execPath, [vite], {
    cwd: client,
    stdio: "inherit",
    windowsHide: true,
  }),
];
function stop() {
  for (const child of children) child.kill();
}
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exitCode = code || 0;
  });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
