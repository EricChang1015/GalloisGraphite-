#!/usr/bin/env node
/**
 * Post the daily engineering digest to Slack (Incoming Webhook).
 *
 * Usage:
 *   SLACK_ENGINEERING_DIGEST_WEBHOOK=https://hooks.slack.com/... \
 *     node scripts/post-engineering-digest.mjs --file digests/2026-05-29.txt
 *
 *   echo "message" | node scripts/post-engineering-digest.mjs
 *
 * Env (first match wins):
 *   SLACK_ENGINEERING_DIGEST_WEBHOOK
 *   SLACK_WEBHOOK_URL
 */

import { readFileSync } from "node:fs";

const webhook =
  process.env.SLACK_ENGINEERING_DIGEST_WEBHOOK?.trim() ||
  process.env.SLACK_WEBHOOK_URL?.trim();

if (!webhook) {
  console.error(
    "Missing SLACK_ENGINEERING_DIGEST_WEBHOOK (or SLACK_WEBHOOK_URL).",
  );
  process.exit(1);
}

const fileIdx = process.argv.indexOf("--file");
let text = "";
if (fileIdx !== -1) {
  const path = process.argv[fileIdx + 1];
  if (!path) {
    console.error("--file requires a path");
    process.exit(1);
  }
  text = readFileSync(path, "utf8").trim();
} else {
  text = readFileSync(0, "utf8").trim();
}

if (!text) {
  console.error("Digest text is empty");
  process.exit(1);
}

const res = await fetch(webhook, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Slack webhook failed: ${res.status} ${body}`);
  process.exit(1);
}

console.log("Posted engineering digest to Slack.");
