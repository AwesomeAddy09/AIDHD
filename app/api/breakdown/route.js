import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonLoose } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, user.id, "breakdown", { limit: 15, windowSeconds: 60 });
  if (!allowed) {
    return NextResponse.json({ error: "Slow down a little — try again in a minute." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const taskText = body?.taskText;
  if (typeof taskText !== "string" || !taskText.trim()) {
    return NextResponse.json({ error: "Nothing to break down" }, { status: 400 });
  }

  try {
    const text = await callClaude(
      "You help someone with ADHD who feels stuck starting a task. Return ONLY valid JSON, no markdown fences: an array of 3 to 6 short strings, each a concrete tiny next physical action, ordered, small enough that starting feels easy.",
      taskText
    );
    const parsed = parseJsonLoose(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Unexpected response shape");
    }

    const steps = parsed.map((s) => String(s).slice(0, 300));
    return NextResponse.json({ steps });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't break that down. Try again in a moment." },
      { status: 502 }
    );
  }
}
