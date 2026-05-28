/**
 * Shared Playwright auth helpers — sets Supabase SSR cookies with chunking
 * (sessions >3180 bytes must be split or middleware treats them as corrupt).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Mirrors @supabase/ssr chunker — inlined to avoid deep CJS/ESM import issues in Node scripts. */
const MAX_CHUNK_SIZE = 3180;

function createChunks(key, value, chunkSize = MAX_CHUNK_SIZE) {
  let encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= chunkSize) {
    return [{ name: key, value }];
  }
  const chunks = [];
  while (encodedValue.length > 0) {
    let encodedChunkHead = encodedValue.slice(0, chunkSize);
    const lastEscapePos = encodedChunkHead.lastIndexOf("%");
    if (lastEscapePos > chunkSize - 3) {
      encodedChunkHead = encodedChunkHead.slice(0, lastEscapePos);
    }
    let valueHead = "";
    while (encodedChunkHead.length > 0) {
      try {
        valueHead = decodeURIComponent(encodedChunkHead);
        break;
      } catch (error) {
        if (
          error instanceof URIError &&
          encodedChunkHead.at(-3) === "%" &&
          encodedChunkHead.length > 3
        ) {
          encodedChunkHead = encodedChunkHead.slice(0, encodedChunkHead.length - 3);
        } else {
          throw error;
        }
      }
    }
    chunks.push(valueHead);
    encodedValue = encodedValue.slice(encodedChunkHead.length);
  }
  return chunks.map((chunkValue, i) => ({ name: `${key}.${i}`, value: chunkValue }));
}

export function loadEnvLocal() {
  return Object.fromEntries(
    readFileSync(resolve(__dirname, "../../.env.local"), "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        return [l.slice(0, i).trim(), v];
      })
  );
}

export async function fetchSupabaseSession(email, password) {
  const env = loadEnvLocal();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY in .env.local");
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Supabase auth failed for ${email}: ${res.status} ${await res.text()}`);
  }
  return { session: await res.json(), supabaseUrl };
}

/** Build chunked `sb-*-auth-token` cookies for Playwright. */
export function buildAuthCookies(supabaseUrl, session, baseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    })
  ).toString("base64")}`;

  const baseHost = new URL(baseUrl).hostname;
  return createChunks(cookieName, cookieValue).map(({ name, value }) => ({
    name,
    value,
    domain: baseHost,
    path: "/",
    sameSite: "Lax",
  }));
}

export async function createAuthenticatedContext(browser, email, password, baseUrl) {
  const { session, supabaseUrl } = await fetchSupabaseSession(email, password);
  const context = await browser.newContext();
  await context.addCookies(buildAuthCookies(supabaseUrl, session, baseUrl));
  return context;
}

export async function assertServerUp(baseUrl) {
  const res = await fetch(`${baseUrl}/login`, { redirect: "manual" }).catch(() => null);
  if (!res || res.status >= 500) {
    throw new Error(
      `Server not reachable at ${baseUrl}. Run: npm run build && npm run start`
    );
  }
}
