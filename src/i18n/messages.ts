import "server-only";

import type { Locale } from "./config";

/**
 * Namespaces that live as individual JSON files under
 * `src/i18n/messages/<locale>/<namespace>.json`.
 *
 * Keep this list in sync with the files on disk. Adding a new namespace:
 *   1. Drop `messages/en/<name>.json`
 *   2. Drop `messages/zh-CN/<name>.json` (same shape)
 *   3. Add `<name>` to NAMESPACES below.
 *
 * Splitting by feature domain (rather than per-component) so translators
 * can work on one context at a time without jumping between files.
 */
const NAMESPACES = [
  "common",
  "nav",
  "dashboard",
  "settings",
  "kyc",
  "enums",
  "errors",
] as const;

type Namespace = (typeof NAMESPACES)[number];
type MessageTree = Record<Namespace, Record<string, unknown>>;

/**
 * Load + merge all namespace JSON for `locale`. Each file becomes a
 * top-level key, so a translation reads as `t('dashboard.title')` from a
 * client component with namespace `dashboard`.
 *
 * Falls back to the English file for any namespace missing in the target
 * locale so a half-translated dictionary still renders something useful
 * (instead of `dashboard.title` raw key).
 */
export async function loadMessages(locale: Locale): Promise<MessageTree> {
  const tree = {} as MessageTree;
  for (const ns of NAMESPACES) {
    try {
      tree[ns] = (await import(`./messages/${locale}/${ns}.json`)).default;
    } catch {
      tree[ns] = (await import(`./messages/en/${ns}.json`)).default;
    }
  }
  return tree;
}
