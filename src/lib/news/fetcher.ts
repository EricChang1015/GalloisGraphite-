import "server-only";

import { z } from "zod";

/**
 * Poe-backed news candidate fetcher.
 *
 * Uses Poe's OpenAI-compatible Chat Completions endpoint. We don't rely on
 * `response_format` (Poe quietly ignores it for some models) — instead we
 * ask the model for raw JSON and then validate with zod, retrying with a
 * stricter follow-up if parsing fails.
 *
 * The model is asked to use its built-in web access to surface real,
 * recent graphite-industry headlines. We always validate URL structure and
 * published_at recency in the server action that consumes this output.
 */

export const NewsCandidateSchema = z.object({
  title: z.string().min(8).max(300),
  summary: z.string().min(20).max(800),
  source_url: z.string().url(),
  source_name: z.string().min(1).max(120).optional(),
  published_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, "expected ISO date")
    .optional(),
  relevance_score: z.number().min(0).max(1).optional(),
  topics: z.array(z.string()).max(6).optional(),
});

export type NewsCandidate = z.infer<typeof NewsCandidateSchema>;

export const NewsCandidateListSchema = z.object({
  items: z.array(NewsCandidateSchema).max(30),
});

export interface FetchNewsCandidatesOptions {
  limit?: number;
  lookbackDays?: number;
  topicHints?: string[];
  model?: string;
  signal?: AbortSignal;
}

export interface FetchNewsCandidatesResult {
  items: NewsCandidate[];
  model: string;
  promptTokens: number;
  completionTokens: number;
  raw: string;
}

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_LIMIT = 12;
const DEFAULT_LOOKBACK_DAYS = 7;

const SYSTEM_PROMPT = `You are a senior commodities analyst tracking the
natural flake graphite supply chain for a Madagascar-based exporter (Mada
Graphite / Graphite Energy Inc.). Your job is to surface fresh, factual
news items that a B2B trader would want to read.

Scope of interest (in priority order):
1. Natural flake graphite production, pricing, supply/demand, new projects
2. Madagascar mining sector, logistics, geopolitics
3. Battery anode / EV upstream material that uses flake graphite
4. Critical minerals policy (US/EU/China/Australia/Africa), export controls,
   tariffs, geopolitical risk affecting graphite
5. ESG / sustainability of the graphite supply chain

Hard rules:
- Each item MUST come from a real, citable web source — copy the canonical
  URL exactly. NEVER invent or guess URLs.
- "summary" must be 2–4 sentences, written in neutral English news style.
- "published_at" must be within the requested lookback window. If you are
  unsure of the date, omit the field.
- Reject press-release noise unrelated to flake graphite or critical minerals.
- relevance_score: 1.0 = directly about flake graphite or Madagascar mining,
  0.5 = adjacent (battery anode, critical-minerals policy), <0.3 = drop it.
- Return STRICT JSON only. No prose, no markdown fences, no commentary.`;

function buildUserPrompt(opts: Required<Omit<FetchNewsCandidatesOptions, "signal" | "model">>): string {
  const topics =
    opts.topicHints.length > 0
      ? `Focus extra hard on these themes: ${opts.topicHints.join(", ")}.\n`
      : "";
  return `${topics}Find the ${opts.limit} most relevant graphite-industry news
items published in the LAST ${opts.lookbackDays} DAYS (today is ${new Date()
    .toISOString()
    .slice(0, 10)}). Use your web access — do not rely on memory.

Return JSON with this exact shape:
{
  "items": [
    {
      "title": "string (original headline, English)",
      "summary": "string (2–4 sentences, neutral English news style)",
      "source_url": "https://...",
      "source_name": "Publication name (e.g. Reuters, Mining.com)",
      "published_at": "YYYY-MM-DD",
      "relevance_score": 0.0–1.0,
      "topics": ["flake-graphite", "madagascar", ...]
    }
  ]
}

Drop items with relevance_score < 0.3 — better to return fewer high-quality
items than to pad the list. Do not include items where you cannot point to a
real source_url.`;
}

/**
 * Extract the first balanced JSON object from a possibly-noisy LLM string.
 * Handles cases where the model wraps the JSON in ```json ... ``` fences or
 * adds a leading sentence.
 */
function extractJson(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();

  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

interface PoeChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callPoe(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  signal?: AbortSignal
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const apiKey = process.env.POE_API_KEY;
  const baseUrl = process.env.POE_BASE_URL?.replace(/\/$/, "");
  if (!apiKey || !baseUrl) {
    throw new Error("POE_API_KEY / POE_BASE_URL not configured.");
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Poe API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as PoeChatResponse;
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Poe API returned empty content.");
  return {
    content,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}

export async function fetchNewsCandidates(
  options: FetchNewsCandidatesOptions = {}
): Promise<FetchNewsCandidatesResult> {
  const model = options.model ?? process.env.POE_NEWS_MODEL ?? DEFAULT_MODEL;
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 3), 25);
  const lookbackDays = Math.min(Math.max(options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, 1), 30);
  const topicHints = options.topicHints ?? [];

  const userPrompt = buildUserPrompt({ limit, lookbackDays, topicHints });

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let promptTokens = 0;
  let completionTokens = 0;
  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const { content, promptTokens: p, completionTokens: c } = await callPoe(
      model,
      messages,
      options.signal
    );
    promptTokens += p;
    completionTokens += c;
    lastRaw = content;

    const jsonText = extractJson(content);
    if (jsonText) {
      try {
        const parsed = NewsCandidateListSchema.parse(JSON.parse(jsonText));
        return {
          items: parsed.items,
          model,
          promptTokens,
          completionTokens,
          raw: content,
        };
      } catch {
        // fall through and retry with a stricter follow-up
      }
    }

    messages.push({ role: "assistant", content });
    messages.push({
      role: "user",
      content:
        "Your previous response did not parse. Reply again with ONLY the JSON object — no markdown fences, no explanation. The schema is the one I described.",
    });
  }

  throw new Error(
    `Could not parse news candidates from model output. Last response (truncated): ${lastRaw.slice(0, 400)}`
  );
}
