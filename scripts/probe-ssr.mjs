#!/usr/bin/env node
// 抓 SSR 回的 HTML，看 data-cursor-ref 是不是真的在 server 端就有。
// 如果有 → 是真的 bug；如果沒有 → 是 MCP / browser extension 注入的。
const url = process.argv[2] ?? "http://localhost:3406/login";
const res = await fetch(url, { redirect: "manual" });
const status = res.status;
const text = await res.text();
const hasCursorRef = /data-cursor-ref/.test(text);
const hits = (text.match(/data-cursor-ref/g) ?? []).length;
console.log(`URL:           ${url}`);
console.log(`Status:        ${status}`);
console.log(`HTML length:   ${text.length}`);
console.log(`data-cursor-ref in SSR:  ${hasCursorRef ? "YES (real bug)" : "NO (injected client-side)"}`);
console.log(`hits:          ${hits}`);
