#!/usr/bin/env node
// Stop Next.js dev/start (or any process) listening on given TCP ports.
// Works on Windows (Git Bash / cmd / PowerShell) via netstat + taskkill,
// and on macOS/Linux via lsof + kill.
//
// Usage:
//   npm run stop                    # port 3000 (or $PORT)
//   npm run stop:all                # 3000, 3001, 3002
//   node scripts/stop-server.mjs 3000 3001
//   PORT=4000 npm run stop
//
// Exit 0 when nothing was listening or all listeners were stopped.

import { execSync } from "node:child_process";

const DEFAULT_PORTS = [3000];
const SYSTEM_PIDS = new Set([0, 4]);

/** @returns {number[]} */
function resolvePorts() {
  const fromArgs = process.argv
    .slice(2)
    .map((a) => Number.parseInt(a, 10))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 65535);
  if (fromArgs.length > 0) return [...new Set(fromArgs)];

  const fromEnv = process.env.PORT
    ? Number.parseInt(process.env.PORT, 10)
    : NaN;
  if (Number.isInteger(fromEnv) && fromEnv > 0) return [fromEnv];

  return DEFAULT_PORTS;
}

/** @param {number} port */
function getListeningPidsWin32(port) {
  const out = execSync("netstat -ano -p tcp", {
    encoding: "utf8",
    windowsHide: true,
  });
  const pids = new Set();
  const portToken = `:${port}`;
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const local = line.trim().split(/\s+/)[1] ?? "";
    if (!local.endsWith(portToken)) continue;
    const pid = Number.parseInt(line.trim().split(/\s+/).at(-1) ?? "", 10);
    if (Number.isInteger(pid) && pid > 0 && !SYSTEM_PIDS.has(pid)) {
      pids.add(pid);
    }
  }
  return pids;
}

/** @param {number} port */
function getListeningPidsUnix(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const pid = Number.parseInt(line.trim(), 10);
      if (Number.isInteger(pid) && pid > 0 && !SYSTEM_PIDS.has(pid)) {
        pids.add(pid);
      }
    }
    return pids;
  } catch {
    return new Set();
  }
}

/** @param {number} port */
function getListeningPids(port) {
  return process.platform === "win32"
    ? getListeningPidsWin32(port)
    : getListeningPidsUnix(port);
}

/** @param {number} pid */
function killPid(pid) {
  if (pid === process.pid) {
    console.warn(`skip: PID ${pid} is this script`);
    return false;
  }
  if (process.platform === "win32") {
    execSync(`taskkill /PID ${pid} /F`, {
      encoding: "utf8",
      windowsHide: true,
    });
    return true;
  }
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (code === "ESRCH") return false;
    throw err;
  }
}

const ports = resolvePorts();
let stopped = 0;

for (const port of ports) {
  const pids = getListeningPids(port);
  if (pids.size === 0) {
    console.log(`port ${port}: no listener`);
    continue;
  }
  for (const pid of pids) {
    try {
      if (killPid(pid)) {
        console.log(`port ${port}: stopped PID ${pid}`);
        stopped += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`port ${port}: failed to stop PID ${pid} — ${msg}`);
      process.exitCode = 1;
    }
  }
}

if (stopped === 0 && process.exitCode !== 1) {
  console.log(`nothing to stop (ports: ${ports.join(", ")})`);
}
