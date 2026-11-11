/**
 * Deletes every DEMO account. Their profiles, listings and chats go with them (ON DELETE CASCADE).
 *   npm run db:unseed
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { scriptSupabaseAdmin } from "../scripts/script-db";

export async function removeDemoUsers(supabase: SupabaseClient) {
  let removed = 0;
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Couldn't list users: ${error.message}`);
    const demo = data.users.filter((u) => u.app_metadata?.hmd_demo === true);
    for (const user of demo) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) throw new Error(`Couldn't delete demo user: ${delError.message}`);
      removed++;
    }
    if (data.users.length < 200) break;
  }
  return removed;
}

async function main() {
  const removed = await removeDemoUsers(scriptSupabaseAdmin());
  console.log(`Removed ${removed} demo accounts and all of their listings.`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/unseed.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
