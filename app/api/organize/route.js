import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonLoose } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

const VALID_CATEGORIES = new Set(["work", "personal", "errand", "health", "admin"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

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

  // The client sends its own local date, since the server's clock may be
  // in a different timezone than the person typing "tomorrow".
  const today = isValidDate(body?.today) ? body.today : new Date().toISOString().slice(0, 10);
  const dayName = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });

  try {
    const text = await callClaude(
      `You are a task organizer inside an ADHD assistant app. Today is ${dayName}, ${today}.

Given a raw brain-dump, extract discrete items. Classify each one as:
- "event": ONLY if a specific clock time is explicitly stated in the input (e.g. "meeting at 10am", "dentist at 2:30"). Never invent or guess a time — if the input doesn't state one, this is not an event.
- "task": everything else, including things that sound like appointments but have no stated time (e.g. "dentist appointment tomorrow" with no time given is a task, not an event)

Resolve any date reference (today, tomorrow, in a week, next Friday, a specific date, etc.) into an absolute date in YYYY-MM-DD format, relative to today's date above. If an item mentions no date or time at all, set date to null — it's a someday/whenever item, not tied to a specific day.

Return ONLY valid JSON, no markdown fences: an array of objects, each with:
- type: "task" or "event"
- text: short description of the item
- category: one of "work", "personal", "errand", "health", "admin"
- date: "YYYY-MM-DD" or null
- minutes: integer duration estimate (tasks only)
- priority: 1 (urgent), 2 (normal), or 3 (low) (tasks only)
- startTime: "HH:MM" in 24-hour time (events only)
- endTime: "HH:MM" in 24-hour time (events only — estimate 30-60 minutes if no end time is stated)

Do not invent items not implied by the input.`,
      dump
    );
    const parsed = parseJsonLoose(text);
    if (!Array.isArray(parsed)) throw new Error("Unexpected response shape");

    const tasks = [];
    const events = [];

    for (const item of parsed) {
      const date = isValidDate(item?.date) ? item.date : null;

      if (
        item?.type === "event" &&
        date &&
        TIME_RE.test(item.startTime) &&
        TIME_RE.test(item.endTime)
      ) {
        const start = timeToMinutes(item.startTime);
        const end = timeToMinutes(item.endTime);
        if (end > start) {
          events.push({ text: String(item.text || "").slice(0, 500), date, start, end });
          continue;
        }
      }

      // Anything that isn't a clean, dated event falls back to a task —
      // better a slightly-off task than a silently dropped item.
      tasks.push({
        text: String(item?.text || "").slice(0, 500),
        category: VALID_CATEGORIES.has(item?.category) ? item.category : "personal",
        minutes: Number.isFinite(item?.minutes) ? Math.max(1, Math.round(item.minutes)) : 20,
        priority: [1, 2, 3].includes(item?.priority) ? item.priority : 2,
        date,
      });
    }

    return NextResponse.json({ tasks, events });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't organize that. Try again in a moment." },
      { status: 502 }
    );
  }
}
