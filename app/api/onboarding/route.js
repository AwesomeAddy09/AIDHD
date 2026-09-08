import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonLoose } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function cleanTime(v) {
  return typeof v === "string" && TIME_RE.test(v) ? v : null;
}

// Turns a free-text sleep-schedule answer ("I go to bed around 11 on
// weekdays, later on weekends, wake up around 7") into structured times
// used to set each day's scheduling window. "idk" / "it's inconsistent"
// style answers should come back all null, not a guess.
export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, user.id, "onboarding", [
    { limit: 10, windowSeconds: 60 },
    { limit: 20, windowSeconds: 86400 },
  ]);
  if (!allowed) {
    return NextResponse.json({ error: "You've hit today's limit for this, try again in a bit." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const answer = body?.answer;
  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json({ weekdayBedtime: null, weekdayWake: null, weekendBedtime: null, weekendWake: null });
  }

  try {
    const text = await callClaude(
      `You parse a free-text answer about someone's sleep schedule into structured times. Return ONLY valid JSON, no markdown fences: an object with keys weekdayBedtime, weekdayWake, weekendBedtime, weekendWake, each either "HH:MM" in 24-hour time or null. Use null for anything not stated, or if the person said they don't know or that it's inconsistent. Never guess a value that wasn't reasonably implied.`,
      answer,
      300
    );
    const parsed = parseJsonLoose(text);
    return NextResponse.json({
      weekdayBedtime: cleanTime(parsed?.weekdayBedtime),
      weekdayWake: cleanTime(parsed?.weekdayWake),
      weekendBedtime: cleanTime(parsed?.weekendBedtime),
      weekendWake: cleanTime(parsed?.weekendWake),
    });
  } catch (e) {
    return NextResponse.json({ weekdayBedtime: null, weekdayWake: null, weekendBedtime: null, weekendWake: null });
  }
}
