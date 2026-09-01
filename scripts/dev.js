const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "webUserPortal");
require("dotenv").config({ path: path.join(rootDir, ".env") });
let shuttingDown = false;

const commands = [
  {
    name: "backend",
    command: process.execPath,
    args: ["src/index.js"],
    cwd: rootDir,
    env: { NODE_ENV: "development" },
  },
  {
    name: "web",
    command: process.execPath,
    args: ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
    cwd: webDir,
    env: { WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
  },
];

function prefixStream(stream, name, writer) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) writer.write(`[${name}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) writer.write(`[${name}] ${buffer}\n`);
  });
}

const children = commands.map(({ name, command, args, cwd, env }) => {
  const child = spawn(command, args, {
    cwd,
    env: process.env.NO_COLOR
      ? { ...process.env, ...env }
      : { ...process.env, ...env, FORCE_COLOR: process.env.FORCE_COLOR || "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  prefixStream(child.stdout, name, process.stdout);
  prefixStream(child.stderr, name, process.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const reason = signal || `code ${code}`;
    console.error(`[dev] ${name} stopped (${reason}); shutting down the other process.`);
    for (const other of children) {
      if (other !== child && !other.killed) other.kill();
    }
    process.exitCode = code || 1;
  });

  return child;
});

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
