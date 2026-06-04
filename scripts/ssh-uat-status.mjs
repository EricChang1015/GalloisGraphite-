#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    const anon = (
      await execCommand(
        conn,
        "grep '^ANON_KEY=' /data/deploy/supabase/upstream/.env | cut -d= -f2-",
      )
    ).trim();
    await execCommand(
      conn,
      `curl -s -w '\\nHTTP:%{http_code}\\n' --resolve uat.gf-v.io:443:127.0.0.1 -H 'apikey: ${anon.replace(/'/g, "'\\''")}' https://uat.gf-v.io/auth/v1/health`,
    );
    await execCommand(
      conn,
      `docker exec -i supabase-db psql -U postgres -d postgres -At -c "select count(*) from public._agent_migrations;"`,
    );
    console.log("\n▸ Set on Vercel:");
    await execCommand(
      conn,
      "grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' /data/deploy/supabase/upstream/.env",
    );
  },
});
