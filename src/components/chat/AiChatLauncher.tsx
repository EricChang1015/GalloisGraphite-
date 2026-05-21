import { FloatingAiChat } from "@/components/chat/FloatingAiChat";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import type { AiChatUserAvatar } from "@/lib/profile/avatar";

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
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();

  let userAvatar: AiChatUserAvatar | null = null;
  if (user && profile) {
    userAvatar = {
      full_name: profile.full_name,
      company_name: profile.company_name,
      avatar_url: profile.avatar_url,
    };
  }

  return (
    <FloatingAiChat
      isAuthenticated={Boolean(user)}
      userAvatar={userAvatar}
    />
  );
}
