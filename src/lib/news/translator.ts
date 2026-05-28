import "server-only";

import { z } from "zod";

import type { Locale } from "@/i18n/config";

/**
 * Translate a single news article using Poe (OpenAI-compatible).
 *
 * Returns null fields if the translation fails — caller decides whether to
 * surface the error to the admin or fall back silently to the English copy.
 */

const TranslationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  content_html: z.string().min(1),
});

export type Translation = z.infer<typeof TranslationSchema>;

export interface TranslateNewsInput {
  title: string;
  summary: string | null;
  contentHtml: string | null;
  targetLocale: Locale;
  model?: string;
}

const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese (zh-CN, 简体中文)",
};

const DEFAULT_TRANSLATION_MODEL = "claude-sonnet-4.6";

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

export async function translateNewsArticle(
  input: TranslateNewsInput
): Promise<Translation> {
  if (input.targetLocale === "en") {
    return {
      title: input.title,
      summary: input.summary ?? "",
      content_html: input.contentHtml ?? "",
    };
  }

  const apiKey = process.env.POE_API_KEY;
  const baseUrl = process.env.POE_BASE_URL?.replace(/\/$/, "");
  if (!apiKey || !baseUrl) {
    throw new Error("POE_API_KEY / POE_BASE_URL not configured.");
  }
  const model = input.model ?? process.env.POE_TRANSLATE_MODEL ?? DEFAULT_TRANSLATION_MODEL;

  const sourceJson = JSON.stringify({
    title: input.title,
    summary: input.summary ?? "",
    content_html: input.contentHtml ?? "",
  });

  const system = `You are a professional news translator covering the
critical-minerals and graphite industry. Translate the given English news
article into ${LOCALE_LABEL[input.targetLocale]}.

Rules:
- Keep proper nouns (company names, places, mine names) in their original
  form; you may append a translated explanation in parentheses on first use.
- Preserve units, numbers, and dates exactly as written.
- Preserve any HTML tags in content_html — translate the text content only.
- Tone: neutral, factual news style. No editorialising.
- Return STRICT JSON only with this shape: {"title": string, "summary": string, "content_html": string}.
  No markdown, no commentary.`;

  const user = `Translate this news article. Source JSON:\n${sourceJson}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Translation API ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const jsonText = extractJson(content);
  if (!jsonText) throw new Error(`Translator returned non-JSON: ${content.slice(0, 200)}`);
  return TranslationSchema.parse(JSON.parse(jsonText));
}
