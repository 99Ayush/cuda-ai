const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const client = path.join(root, "apps/web");
const resolve = createRequire(path.join(client, "package.json")).resolve;
const vite = path.join(path.dirname(resolve("vite/package.json")), "bin/vite.js");

// Dev runs the same compiled TypeScript build as production so there is a single
// runtime implementation. Rebuild shared + API before starting the watchers.
for (const script of ["build:shared", "build:api"]) {
  const build = spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    windowsHide: true,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const children = [
  spawn(process.execPath, ["--watch", "apps/api/dist/index.js"], {
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
