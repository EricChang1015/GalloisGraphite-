#!/usr/bin/env node
import { withJumpSsh, execCommand } from "./lib/ssh-jump.mjs";

await withJumpSsh({
  async onTarget(conn) {
    const sql = `
select 'profiles' as t, count(*)::text as n from public.profiles
union all select 'orders', count(*)::text from public.orders
union all select 'auth.users', count(*)::text from auth.users
union all select 'storage.objects', count(*)::text from storage.objects
union all select 'listings', count(*)::text from public.listings;
`;
    await execCommand(
      conn,
      `docker exec -i supabase-db psql -U postgres -d postgres -c "${sql.replace(/\n/g, " ")}"`,
    );
  },
});
