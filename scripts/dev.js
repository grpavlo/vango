const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "webUserPortal");
require("dotenv").config({ path: path.join(rootDir, ".env") });
let shuttingDown = false;
let localPostgres = null;

function findPostgresBinary(name) {
  const exeName = process.platform === "win32" ? `${name}.exe` : name;
  const candidates = [
    process.env.POSTGRES_BIN && path.join(process.env.POSTGRES_BIN, exeName),
    process.env.POSTGRES_HOME && path.join(process.env.POSTGRES_HOME, "bin", exeName),
  ].filter(Boolean);

  if (process.platform === "win32") {
    for (const version of ["18", "17", "16", "15", "14", "13"]) {
      candidates.push(path.join("C:\\Program Files\\PostgreSQL", version, "bin", exeName));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const locator = process.platform === "win32" ? "where" : "which";
  const located = spawnSync(locator, [exeName], { encoding: "utf8" });
  if (located.status === 0) {
    return located.stdout.split(/\r?\n/).find(Boolean);
  }

  return null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${path.basename(command)} failed: ${output || `exit ${result.status}`}`);
  }

  return result;
}

function startLocalPostgres() {
  if (process.env.VANGO_LOCAL_POSTGRES !== "1") return null;

  const initdb = findPostgresBinary("initdb");
  const pgCtl = findPostgresBinary("pg_ctl");
  const psql = findPostgresBinary("psql");
  const createdb = findPostgresBinary("createdb");
  const missing = [
    ["initdb", initdb],
    ["pg_ctl", pgCtl],
    ["psql", psql],
    ["createdb", createdb],
  ].filter(([, binary]) => !binary);

  if (missing.length) {
    throw new Error(
      `VANGO_LOCAL_POSTGRES=1, but PostgreSQL binaries are missing: ${missing
        .map(([name]) => name)
        .join(", ")}`
    );
  }

  const dataDir = process.env.VANGO_LOCAL_POSTGRES_DATA_DIR
    ? path.resolve(rootDir, process.env.VANGO_LOCAL_POSTGRES_DATA_DIR)
    : path.join(rootDir, ".dev-postgres");
  const logsDir = path.join(dataDir, "logs");
  const port = process.env.VANGO_LOCAL_POSTGRES_PORT || "55432";
  const user = process.env.VANGO_LOCAL_POSTGRES_USER || "postgres";
  const database = process.env.VANGO_LOCAL_POSTGRES_DATABASE || "vango";

  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[dev-db] initializing local Postgres at ${dataDir}`);
    run(initdb, ["-D", dataDir, "--username", user, "--auth=trust", "--encoding=UTF8"], {
      stdio: "inherit",
    });
  }

  const status = spawnSync(pgCtl, ["status", "-D", dataDir], {
    cwd: rootDir,
    encoding: "utf8",
  });

  const alreadyRunning = status.status === 0;
  if (!alreadyRunning) {
    fs.mkdirSync(logsDir, { recursive: true });
    const logFile = path.join(
      logsDir,
      `postgres-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
    );
    console.log(`[dev-db] starting local Postgres on port ${port}`);
    run(pgCtl, ["start", "-D", dataDir, "-l", logFile, "-o", `-p ${port}`, "-w"], {
      stdio: "inherit",
    });
  }

  const exists = run(psql, [
    "-h",
    "localhost",
    "-p",
    port,
    "-U",
    user,
    "-d",
    "postgres",
    "-tAc",
    `select 1 from pg_database where datname='${database.replace(/'/g, "''")}'`,
  ]).stdout.trim();

  if (exists !== "1") {
    console.log(`[dev-db] creating database ${database}`);
    run(createdb, ["-h", "localhost", "-p", port, "-U", user, database], {
      stdio: "inherit",
    });
  }

  process.env.DATABASE_URL = `postgres://${user}@localhost:${port}/${database}`;
  return { pgCtl, dataDir, startedByThisProcess: !alreadyRunning };
}

try {
  localPostgres = startLocalPostgres();
} catch (err) {
  console.error(`[dev-db] ${err.message}`);
  process.exit(1);
}

const commands = [
  {
    name: "backend",
    command: process.execPath,
    args: ["--watch", "--watch-path", "src", "src/index.js"],
    cwd: rootDir,
    env: {
      NODE_ENV: "development",
      DEV_SMS_BYPASS: process.env.DEV_SMS_BYPASS || "1",
      DEV_AUTH_CODE: process.env.DEV_AUTH_CODE || "111111",
    },
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
    stopLocalPostgres();
    process.exitCode = code || 1;
  });

  return child;
});

function stopLocalPostgres() {
  if (!localPostgres?.startedByThisProcess) return;
  spawnSync(localPostgres.pgCtl, ["stop", "-D", localPostgres.dataDir, "-m", "fast", "-w"], {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  stopLocalPostgres();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
