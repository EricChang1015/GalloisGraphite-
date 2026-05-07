import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Privileged Supabase client using the service role key.
 *
 * NEVER import this from a Client Component. The `import "server-only"`
 * directive will crash the build if you accidentally do.
 *
 * Use only for trusted operations — e.g. promoting a user, sending
 * transactional email, verifying payments, or any flow that legitimately
 * needs to bypass RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY env variable."
    );
  }
  return createServiceClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
