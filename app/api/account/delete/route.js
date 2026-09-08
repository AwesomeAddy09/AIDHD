import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Deleting the underlying auth.users row is the only way to actually
// remove an account (not just its app data), and that requires the
// service role key — RLS only governs the public.* tables, not Supabase
// Auth's own user table. Every other route in this app runs entirely
// through the user's own RLS-scoped session; this is the sole exception,
// and it's narrowly scoped: the id being deleted always comes from the
// caller's own verified session below, never from the request body, so
// there's no way to pass someone else's id here.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Account deletion isn't set up yet. Contact support." }, { status: 500 });
  }

  const admin = createSupabaseAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cascades to every table via each one's "on delete cascade" foreign
  // key (tasks, events, recaps, profiles, recordings, api_usage) — no
  // per-table deletion code needed, see supabase/schema.sql.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "Couldn't delete your account. Try again or contact support." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
