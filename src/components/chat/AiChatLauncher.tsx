import { createServerClient } from "@/lib/supabase/server";
import { FloatingAiChat } from "@/components/chat/FloatingAiChat";

/**
 * Server component wrapper that resolves the Supabase auth state once and
 * forwards it to the client-side floating launcher. Mount this in any
 * layout where the AI assistant should be available.
 *
 * NOTE: keep this server-only — it is the only place the layouts see the
 * supabase client for AI purposes, so the launcher itself never imports
 * server-only modules.
 */
export async function AiChatLauncher() {
  let isAuthenticated = false;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    isAuthenticated = Boolean(data.user);
  } catch {
    isAuthenticated = false;
  }

  return <FloatingAiChat isAuthenticated={isAuthenticated} />;
}
