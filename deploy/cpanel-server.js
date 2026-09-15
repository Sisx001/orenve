/**
 * ORYNVE v2 — cPanel / Passenger / generic Node host entry point.
 *
 * Set this file as the "Application startup file" in cPanel → Setup Node.js App
 * (Application root = the project folder). Passenger injects PORT.
 *
 * Build first with:  DEPLOY_TARGET=server npm run build
 * (the "server" target skips the standalone bundle so `next start` semantics
 * serve everything — CSS, images, uploads — without copying static folders).
 *
 * Works in three modes, in order of preference:
 *  1. Programmatic `next` server (no standalone needed)
 *  2. Standalone bundle, if it exists AND its static assets were copied in
 *  3. `npm start` child process (last resort)
 */
"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Load .env from the project root if the host didn't inject variables.
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
  }
}

function startProgrammatic() {
  const next = require(path.join(ROOT, "node_modules", "next"));
  const app = next({ dev: false, dir: ROOT, hostname: HOST, port: PORT });
  const handle = app.getRequestHandler();
  return app.prepare().then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(PORT, HOST, () => console.log(`[orynve] ready on http://${HOST}:${PORT} (next programmatic)`));
  });
}

function startStandalone() {
  const server = path.join(ROOT, ".next", "standalone", "server.js");
  const staticDir = path.join(ROOT, ".next", "standalone", ".next", "static");
  if (!fs.existsSync(server) || !fs.existsSync(staticDir)) return false;
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = HOST;
  require(server);
  return true;
}

function startNpm() {
  const { spawn } = require("child_process");
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["start"], { cwd: ROOT, env: process.env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(sig, () => child.kill(sig));
}

const hasBuild = fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"));
if (!hasBuild) {
  console.error("[orynve] No production build found. Run: DEPLOY_TARGET=server npm run build");
  process.exit(1);
}

startProgrammatic().catch((err) => {
  console.warn("[orynve] programmatic start failed, trying standalone:", err && err.message);
  if (!startStandalone()) {
    console.warn("[orynve] standalone unavailable, falling back to `npm start`");
    startNpm();
  }
});
