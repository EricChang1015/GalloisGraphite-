#!/usr/bin/env node
// Analyse .next/dev/logs/next-development.log and report real ERROR/WARN
// entries, filtering out the well-known false-positives caused by browser
// extensions (Bitdefender's `bis_skin_checked`, ColorZilla's
// `cz-shortcut-listen`) and the cursor-ide-browser MCP's `data-cursor-ref`
// injection.
//
// Usage:
//   node scripts/check-dev-errors.mjs                    # default log path
//   node scripts/check-dev-errors.mjs <path-to-log>
//   node scripts/check-dev-errors.mjs --tail <N>         # last N entries only
//   node scripts/check-dev-errors.mjs --report           # also write dev-errors.latest.txt
//
// Exit code is 0 when there are no real ERRORs left after filtering,
// 1 otherwise — suitable for CI / pre-commit assertion.
//
// The report file survives page navigation (unlike the Next.js dev overlay badge).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const KNOWN_FALSE_POSITIVE_MARKERS = [
  "data-cursor-ref",        // cursor-ide-browser MCP injects this in DOM
  "bis_skin_checked",       // Bitdefender Anti-Tracker extension
  "cz-shortcut-listen",     // ColorZilla extension
];

// Substrings in `message` that mean "known environment / dev-only noise we
// don't want to be reminded about every test run". Hide these unless invoked
// with `--all`.
const KNOWN_BENIGN_MESSAGE_PATTERNS = [
  "Slow filesystem detected",                       // Windows + NTFS dev cache
  "Download the React DevTools",                     // dev hint
  "[HMR] connected",                                 // hot reload notice
];

const args = process.argv.slice(2);
let logPath = ".next/dev/logs/next-development.log";
let tail = Number.POSITIVE_INFINITY;
let showAll = false;
let writeReport = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tail") {
    tail = Number(args[++i] ?? "100");
  } else if (args[i] === "--all") {
    showAll = true;
  } else if (args[i] === "--report") {
    writeReport = true;
  } else if (!args[i].startsWith("--")) {
    logPath = args[i];
  }
}

const REPORT_PATH = resolve("dev-errors.latest.txt");

const abs = resolve(logPath);
if (!existsSync(abs)) {
  console.error(`Log file not found: ${abs}`);
  console.error(`(Run \`npm run dev\` first to generate it.)`);
  process.exit(2);
}

const raw = readFileSync(abs, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);
const entries = [];
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.level === "ERROR" || obj.level === "WARN") entries.push(obj);
  } catch {
    /* ignore non-JSON */
  }
}
const considered = entries.slice(-tail);

const real = [];
const filtered = [];
for (const e of considered) {
  const msg = String(e.message ?? "");
  const isHydrationMismatch =
    msg.includes("hydrat") || msg.includes("rendered HTML didn't match");
  const onlyKnownFalsePositive =
    isHydrationMismatch &&
    KNOWN_FALSE_POSITIVE_MARKERS.some((m) => msg.includes(m)) &&
    !hasUnknownDiffAttribute(msg);
  const isBenignEnvWarn =
    !showAll &&
    KNOWN_BENIGN_MESSAGE_PATTERNS.some((p) => msg.includes(p));
  if (onlyKnownFalsePositive) filtered.push({ entry: e, reason: "extension-injection" });
  else if (isBenignEnvWarn) filtered.push({ entry: e, reason: "benign-env-warn" });
  else real.push(e);
}

function hasUnknownDiffAttribute(msg) {
  // Look at lines of the form `-                ATTR="VALUE"` inside the diff.
  // If every `-`-prefixed attribute line is one of the known markers, it's a
  // false positive. If even one names a different attribute, treat as real.
  const diffLines = msg.split(/\n/).filter((l) => /^-\s+\S/.test(l.trimEnd()));
  if (diffLines.length === 0) return false;
  for (const line of diffLines) {
    const attrMatch = line.match(/^-\s+([A-Za-z_:-][\w:-]*)\s*=/);
    if (!attrMatch) {
      // a `-` line that isn't an attribute diff (e.g. React's bullet list of
      // possible causes) — ignore it.
      continue;
    }
    const attr = attrMatch[1];
    if (!KNOWN_FALSE_POSITIVE_MARKERS.includes(attr)) return true;
  }
  return false;
}

const filterBreakdown = filtered.reduce((acc, x) => {
  acc[x.reason] = (acc[x.reason] ?? 0) + 1;
  return acc;
}, {});

console.log(`Log file:                ${abs}`);
console.log(`Total ERROR+WARN:        ${entries.length}`);
console.log(`Considered (last ${tail === Infinity ? "all" : tail}): ${considered.length}`);
console.log(`Filtered:                ${filtered.length}  ${JSON.stringify(filterBreakdown)}`);
console.log(`Real (require attention):${real.length}${showAll ? "  [--all: benign env warns shown]" : ""}`);

if (real.length > 0) {
  console.log("");
  console.log("=== Real ERROR / WARN entries ===");
  for (const e of real) {
    const oneLine = String(e.message ?? "")
      .split(/\n/)[0]
      .slice(0, 200);
    console.log(`[${e.timestamp}] ${e.source} ${e.level}: ${oneLine}`);
  }
}

if (writeReport) {
  const generatedAt = new Date().toISOString();
  const blocks = [
    `# Dev errors report — ${generatedAt}`,
    `# Log: ${abs}`,
    `# Total ERROR+WARN in log: ${entries.length}`,
    `# Considered: ${considered.length} | Filtered: ${filtered.length} | Real: ${real.length}`,
    `# Real ERROR count: ${real.filter((e) => e.level === "ERROR").length}`,
    "",
  ];
  if (real.length === 0) {
    blocks.push("(no real ERROR/WARN entries after filtering)");
  } else {
    for (const e of real) {
      const headline = String(e.message ?? "")
        .split(/\n/)[0]
        .slice(0, 300);
      blocks.push(`[${e.timestamp}] ${e.source} ${e.level}: ${headline}`);
      blocks.push("");
    }
  }
  writeFileSync(REPORT_PATH, blocks.join("\n"), "utf8");
  console.log(`Report written:          ${REPORT_PATH}`);
}

const realErrors = real.filter((e) => e.level === "ERROR");
process.exit(realErrors.length > 0 ? 1 : 0);
