#!/usr/bin/env node
// Probe SSR HTML for hydration-mismatch markers.
//
// Usage:
//   node scripts/probe-ssr.mjs <url> [marker1 marker2 ...]
//
// Defaults to checking the two markers that account for ~all noisy hydration
// errors in this project:
//   - `data-cursor-ref`   (injected by cursor-ide-browser MCP, client-side)
//   - `bis_skin_checked`  (injected by Bitdefender browser extension)
//   - `cz-shortcut-listen` (injected by ColorZilla extension, occasionally)
//
// Exit code is 0 if NONE of the markers are present in the SSR HTML (i.e. they
// must be client-side injections, safe to ignore as false-positive hydration
// noise). Exit code 1 if any marker is present in SSR HTML — that means it is
// a real server/client mismatch and must be fixed.
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/probe-ssr.mjs <url> [marker1 marker2 ...]");
  process.exit(2);
}
const url = args[0];
const markers = args.length > 1
  ? args.slice(1)
  : ["data-cursor-ref", "bis_skin_checked", "cz-shortcut-listen"];

const res = await fetch(url, { redirect: "manual" });
const status = res.status;
const text = await res.text();

console.log(`URL:           ${url}`);
console.log(`Status:        ${status}`);
console.log(`HTML length:   ${text.length}`);
if (status >= 300 && status < 400) {
  console.log(`(redirect — body too short to evaluate, sign in or hit a public page)`);
  process.exit(0);
}

let realBug = false;
for (const marker of markers) {
  const re = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const hits = (text.match(re) ?? []).length;
  const verdict = hits > 0 ? "REAL BUG (in SSR HTML)" : "client-side injection (safe to ignore)";
  console.log(`  ${marker.padEnd(22)} hits=${String(hits).padStart(3)}  →  ${verdict}`);
  if (hits > 0) realBug = true;
}
process.exit(realBug ? 1 : 0);
