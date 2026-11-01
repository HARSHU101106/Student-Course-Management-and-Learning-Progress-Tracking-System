#!/usr/bin/env node
/**
 * Boots the whole stack and runs the browser flows (flows.cjs). Cross-platform (no bash needed).
 *
 * Prerequisites: MongoDB reachable at E2E_MONGO_URI (default mongodb://127.0.0.1:27017), Python deps installed
 * for ai-service (pip install -r ai-service/requirements.txt), `npm ci` in server/, client/ and e2e/.
 *   E2E_PYTHON   Python executable (default: python on Windows, python3 elsewhere)
 *   E2E_MONGO_URI
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mongo = process.env.E2E_MONGO_URI || "mongodb://127.0.0.1:27017";
const python = process.env.E2E_PYTHON || (process.platform === "win32" ? "python" : "python3");
const isWin = process.platform === "win32";
const db = "adaptlearn_e2e";
const secrets = {
  AI_SERVICE_TOKEN: "e2e-shared-service-token-0123456789",
  JWT_SECRET: "e2e-jwt-secret-e2e-jwt-secret-e2e-jwt-secret",
};
const admin = { email: "admin@adaptlearn.dev", password: "Admin-E2E-Passw0rd!" };
const children = [];
const apiOnly = process.argv.includes("--api-only"); // run the Postman collection (Newman) instead of the browser flows

function start(name, command, args, options) {
  const child = spawn(command, args, { ...options, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"], shell: isWin });
  const tail = [];
  const keep = (chunk) => { tail.push(String(chunk)); if (tail.length > 40) tail.shift(); };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  child.on("exit", (code) => { if (code && !child.killed) console.error(`[${name}] exited with ${code}\n${tail.join("")}`); });
  children.push(child);
  return child;
}

async function waitFor(url, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: isWin, ...options });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`))));
  });
}

function stopAll() {
  for (const child of children) {
    try { child.killed || (isWin ? spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]) : child.kill("SIGTERM")); } catch { /* already gone */ }
  }
}
process.on("SIGINT", () => { stopAll(); process.exit(130); });

let exitCode = 1;
try {
  console.log("Resetting the e2e database…");
  const { default: mongoose } = await import(path.join(root, "server/node_modules/mongoose/index.js").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));
  await mongoose.connect(`${mongo}/${db}`, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log("Starting AI service, API and web app…");
  start("ai", python, ["-m", "uvicorn", "app.main:app", "--port", "8000", "--log-level", "warning"], {
    cwd: path.join(root, "ai-service"),
    env: { ENVIRONMENT: "development", AI_SERVICE_TOKEN: secrets.AI_SERVICE_TOKEN, MONGO_URI: mongo, MONGO_DB: db },
  });
  await waitFor("http://127.0.0.1:8000/health", "AI service");

  start("api", process.execPath, ["src/server.js"], {
    cwd: path.join(root, "server"),
    env: {
      NODE_ENV: "production", PORT: "5000", MONGO_URI: `${mongo}/${db}`, BCRYPT_ROUNDS: "6", JWT_SECRET: secrets.JWT_SECRET,
      CLIENT_URL: "http://localhost:4173", ADMIN_EMAIL: admin.email, ADMIN_PASSWORD: admin.password,
      AI_SERVICE_URL: "http://127.0.0.1:8000", AI_SERVICE_TOKEN: secrets.AI_SERVICE_TOKEN, SEED_ON_BOOT: "true", SEED_DEMO_USERS: "true",
    },
  });
  await waitFor("http://127.0.0.1:5000/api/health/ready", "API");

  if (apiOnly) {
    console.log("Running the Postman collection with Newman…");
    await run("npx", ["newman", "run", "adaptlearn.postman_collection.json", "--env-var", "baseUrl=http://localhost:5000", "--reporters", "cli,json", "--reporter-json-export", path.join(process.env.E2E_TMP_DIR || (await import("node:os")).tmpdir(), "adaptlearn-newman.json")], { cwd: path.join(root, "postman") });
    exitCode = 0;
  } else {
    console.log("Building the client…");
    await run("npm", ["run", "build"], { cwd: path.join(root, "client") });
    start("web", "npx", ["vite", "preview", "--port", "4173", "--strictPort"], { cwd: path.join(root, "client"), env: {} });
    await waitFor("http://localhost:4173/", "web app");

    console.log("Running browser flows…");
    await run(process.execPath, ["flows.cjs"], { cwd: path.dirname(fileURLToPath(import.meta.url)) });
    exitCode = 0;
  }
} catch (error) {
  console.error(`\nE2E failed: ${error.message}`);
} finally {
  stopAll();
  setTimeout(() => process.exit(exitCode), 500);
}
