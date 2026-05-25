import { readFileSync } from "node:fs";

/** Parse `.env.local` into a plain object (no dotenv dep). */
export function loadEnvLocal() {
  return Object.fromEntries(
    readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        return [l.slice(0, i).trim(), v];
      })
  );
}

export function projectRefFromUrl(url) {
  return new URL(url).hostname.split(".")[0];
}

export function createAdminQuery(env) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!token || !ref) {
    throw new Error("Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL");
  }
  return async function adminQuery(sql) {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: sql }),
      }
    );
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
    return body ? JSON.parse(body) : [];
  };
}

export function sqlEscape(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}
