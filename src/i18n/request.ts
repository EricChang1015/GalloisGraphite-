import { getRequestConfig } from "next-intl/server";

import { getLocale } from "./get-locale";
import { loadMessages } from "./messages";

/**
 * next-intl request config — invoked by the plugin on every server render.
 *
 * Pulls the resolved locale (cookie → DB → header → default) and merges all
 * namespace JSON files for that locale into a single message tree.
 */
export default getRequestConfig(async () => {
  const locale = await getLocale();
  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
    timeZone: "UTC",
  };
});
