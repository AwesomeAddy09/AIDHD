import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic";

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const completed = Array.isArray(body?.completed) ? body.completed : [];
  const remaining = Array.isArray(body?.remaining) ? body.remaining : [];

  try {
    const text = await callClaude(
      "You write brief, warm, non-judgmental end-of-day recaps for an ADHD productivity app. Write two short paragraphs: first acknowledging today honestly and kindly, no guilt, no hype. Second previewing what's left simply. Plain text only, under 120 words total.",
      `Completed today: ${completed.join(", ") || "nothing marked done"}.\nStill open: ${
        remaining.join(", ") || "nothing left"
      }.`
    );
    return NextResponse.json({ recap: text.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't put together a recap. Try again in a moment." },
      { status: 502 }
    );
  }
}
