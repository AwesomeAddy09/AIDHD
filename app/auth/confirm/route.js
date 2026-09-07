import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the link from Supabase's confirmation/magic-link email.
// See the setup walkthrough for the one-time email template change
// this route depends on (Authentication > Email Templates in Supabase).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
