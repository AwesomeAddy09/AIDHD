import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonLoose } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

const VALID_CATEGORIES = new Set(["work", "personal", "errand", "health", "admin"]);

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, user.id, "organize", { limit: 8, windowSeconds: 60 });
  if (!allowed) {
    return NextResponse.json({ error: "Slow down a little — try again in a minute." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const dump = body?.dump;
  if (typeof dump !== "string" || !dump.trim()) {
    return NextResponse.json({ error: "Nothing to organize" }, { status: 400 });
  }
  if (dump.length > 6000) {
    return NextResponse.json(
      { error: "That's a lot to sort at once — try a shorter dump" },
      { status: 400 }
    );
  }

  try {
    const text = await callClaude(
      "You are a task organizer inside an ADHD assistant app. Given a raw brain-dump, extract discrete actionable tasks. Return ONLY valid JSON, no markdown fences: an array of objects with keys text, category (work, personal, errand, health, or admin), minutes (integer estimate), priority (1 urgent, 2 normal, 3 low). Do not invent tasks not implied by the input.",
      dump
    );
    const parsed = parseJsonLoose(text);
    if (!Array.isArray(parsed)) throw new Error("Unexpected response shape");

    const tasks = parsed.map((t) => ({
      text: String(t.text || "").slice(0, 500),
      category: VALID_CATEGORIES.has(t.category) ? t.category : "personal",
      minutes: Number.isFinite(t.minutes) ? Math.max(1, Math.round(t.minutes)) : 20,
      priority: [1, 2, 3].includes(t.priority) ? t.priority : 2,
    }));

    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't organize that. Try again in a moment.", debug: e?.message, debugStatus: e?.status },
      { status: 502 }
    );
  }
}
