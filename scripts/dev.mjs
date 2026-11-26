import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Launch Node entrypoints directly so Windows does not need npm.ps1 or a shell.
const commands = [
  ["--import", "tsx", "apps/api/src/dev.ts"],
  ["node_modules/vite/bin/vite.js", "--config", "apps/web/vite.config.ts"],
];
const children = commands.map((args) => spawn(process.execPath, args, { cwd: root, stdio: "inherit" }));
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code ?? 1); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
