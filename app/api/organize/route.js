import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonLoose } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

const VALID_CATEGORIES = new Set(["work", "personal", "errand", "health", "admin"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const RECUR_WINDOW_DAYS = 84; // ~12 weeks

function isValidDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Expands a recurring pattern into concrete event rows within a bounded
// window — no recurrence engine needed elsewhere in the app, every other
// piece of code just sees plain dated events.
function expandRecurring(item, today) {
  const days = Array.isArray(item.days) ? item.days.map((d) => String(d).toLowerCase()) : [];
  let dayIndices;
  if (days.includes("daily")) {
    dayIndices = [0, 1, 2, 3, 4, 5, 6];
  } else if (days.includes("weekdays")) {
    dayIndices = [1, 2, 3, 4, 5];
  } else if (days.includes("weekends")) {
    dayIndices = [0, 6];
  } else {
    dayIndices = days.map((d) => DAY_ABBR.indexOf(d)).filter((i) => i !== -1);
  }
  if (dayIndices.length === 0) return [];
  if (!TIME_RE.test(item.startTime) || !TIME_RE.test(item.endTime)) return [];
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);
  if (end <= start) return [];

  const until = isValidDate(item.untilDate) ? item.untilDate : addDays(today, RECUR_WINDOW_DAYS);
  const cap = addDays(today, RECUR_WINDOW_DAYS);
  const boundary = until < cap ? until : cap;

  const occurrences = [];
  for (let d = today; d <= boundary; d = addDays(d, 1)) {
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    if (dayIndices.includes(dow)) {
      occurrences.push({ text: String(item.text || "").slice(0, 500), date: d, start, end });
    }
  }
  return occurrences;
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

  const today = isValidDate(body?.today) ? body.today : new Date().toISOString().slice(0, 10);
  const dayName = new Date(today + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });

  // Existing items, so the same free-text box can also recognize "move
  // the dentist appointment to 4pm" or "cancel team meeting" rather than
  // only ever creating new things.
  const [{ data: existingTasks }, { data: existingEvents }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,text,category,minutes,priority,due_date,done")
      .order("created_at", { ascending: true })
      .limit(150),
    supabase
      .from("events")
      .select("id,text,event_date,start_min,end_min")
      .order("event_date", { ascending: true })
      .limit(150),
  ]);

  const taskSummary = (existingTasks || [])
    .map((t) => `- ${t.id}: "${t.text}" (${t.category}, ${t.minutes}min, priority ${t.priority}, due ${t.due_date || "none"}, ${t.done ? "done" : "not done"})`)
    .join("\n") || "(none)";
  const eventSummary = (existingEvents || [])
    .map((e) => `- ${e.id}: "${e.text}" on ${e.event_date} from ${String(Math.floor(e.start_min / 60)).padStart(2, "0")}:${String(e.start_min % 60).padStart(2, "0")} to ${String(Math.floor(e.end_min / 60)).padStart(2, "0")}:${String(e.end_min % 60).padStart(2, "0")}`)
    .join("\n") || "(none)";

  const knownTaskIds = new Set((existingTasks || []).map((t) => t.id));
  const knownEventIds = new Set((existingEvents || []).map((e) => e.id));

  try {
    const text = await callClaude(
      `You are a task organizer inside an ADHD assistant app. Today is ${dayName}, ${today}.

EXISTING TASKS:
${taskSummary}

EXISTING EVENTS:
${eventSummary}

Given a raw brain-dump, first check whether it refers to changing, completing, or removing one of the EXISTING items above (matching by meaning/description, not exact wording — e.g. "the dentist appointment" matches an existing event about a dentist). Only treat it as a modification if you're confident it refers to something already listed above; if you're unsure, or it sounds like something new, treat it as a new item instead.

For everything that isn't a modification of an existing item, extract discrete new items and classify each as:
- "event": a specific clock time IS stated, and AM/PM (or an unambiguous context clue like "school", "lunch", typical business hours) makes the meridiem clear.
- "ambiguous_time": a clock time is stated but you genuinely cannot tell AM from PM from context (e.g. "call mom at 3" with nothing else to go on). Do not guess — flag it instead. Only use this when truly ambiguous; most times have enough context to resolve.
- "appointment": sounds like a meeting, call, appointment, or scheduled event, but NO clock time at all is stated (e.g. "dentist appointment tomorrow"). Do not guess a time.
- "recurring": describes a repeating schedule (e.g. "school every day from 8am to 3pm", "work Mon-Fri 9-5"). Needs explicit start and end times.
- "task": a plain flexible to-do with no time concept (e.g. "math homework", "email the landlord").

Resolve any date reference (today, tomorrow, in a week, next Friday, a specific date, etc.) into an absolute date in YYYY-MM-DD format, relative to today's date above. If a clock time is stated but no date is mentioned, assume the date is today. If an item mentions no date or time at all, set date to null.

Return ONLY valid JSON, no markdown fences: an object with two keys, "items" and "modifications".

"items" is an array of objects, each with:
- type: "task", "event", "ambiguous_time", "appointment", or "recurring"
- text: short description
- category: one of "work", "personal", "errand", "health", "admin" (task and appointment only)
- date: "YYYY-MM-DD" or null
- minutes: integer duration estimate (task only)
- priority: 1 (urgent), 2 (normal), or 3 (low) (task only)
- startTime: "HH:MM" 24-hour (event and recurring only)
- endTime: "HH:MM" 24-hour (event and recurring only — estimate 30-60 min if unstated, for events only, not recurring)
- hour: 1-12 (ambiguous_time only)
- minute: 0-59 (ambiguous_time only)
- days: array of "mon","tue","wed","thu","fri","sat","sun" (or ["daily"], ["weekdays"], ["weekends"]) (recurring only)
- untilDate: "YYYY-MM-DD" or null for ongoing (recurring only)

"modifications" is an array of objects, each with:
- targetType: "task" or "event"
- id: the exact id string from the EXISTING lists above — never invent one
- action: "update", "delete", or "complete" (complete only valid for tasks — marks it done)
- changes: only for "update" — an object with just the fields being changed (task: text/category/minutes/priority/date; event: text/date/startTime/endTime)

Do not invent items not implied by the input.`,
      dump,
      2000
    );
    const parsed = parseJsonLoose(text);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const rawModifications = Array.isArray(parsed?.modifications) ? parsed.modifications : [];

    const tasks = [];
    const events = [];
    const needsTime = [];
    const ambiguousTime = [];

    for (const item of items) {
      const date = isValidDate(item?.date) ? item.date : null;

      if (item?.type === "recurring") {
        events.push(...expandRecurring(item, today));
        continue;
      }

      if (item?.type === "ambiguous_time" && date) {
        const hour = Number(item.hour);
        const minute = Number(item.minute);
        if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
          ambiguousTime.push({ text: String(item.text || "").slice(0, 500), date, hour, minute });
          continue;
        }
      }

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

      if (item?.type === "appointment") {
        needsTime.push({ text: String(item.text || "").slice(0, 500), date: date || today });
        continue;
      }

      tasks.push({
        text: String(item?.text || "").slice(0, 500),
        category: VALID_CATEGORIES.has(item?.category) ? item.category : "personal",
        minutes: Number.isFinite(item?.minutes) ? Math.max(1, Math.round(item.minutes)) : 20,
        priority: [1, 2, 3].includes(item?.priority) ? item.priority : 2,
        date,
      });
    }

    // Only accept modifications that reference an id we actually sent —
    // never trust an invented or mistyped one.
    const modifications = [];
    for (const m of rawModifications) {
      if (m?.targetType === "task" && knownTaskIds.has(m.id) && ["update", "delete", "complete"].includes(m.action)) {
        const mod = { targetType: "task", id: m.id, action: m.action };
        if (m.action === "update" && m.changes && typeof m.changes === "object") {
          const changes = {};
          if (typeof m.changes.text === "string") changes.text = m.changes.text.slice(0, 500);
          if (VALID_CATEGORIES.has(m.changes.category)) changes.category = m.changes.category;
          if (Number.isFinite(m.changes.minutes)) changes.minutes = Math.max(1, Math.round(m.changes.minutes));
          if ([1, 2, 3].includes(m.changes.priority)) changes.priority = m.changes.priority;
          if (m.changes.date === null || isValidDate(m.changes.date)) changes.date = m.changes.date;
          mod.changes = changes;
        }
        modifications.push(mod);
      } else if (m?.targetType === "event" && knownEventIds.has(m.id) && ["update", "delete"].includes(m.action)) {
        const mod = { targetType: "event", id: m.id, action: m.action };
        if (m.action === "update" && m.changes && typeof m.changes === "object") {
          const changes = {};
          if (typeof m.changes.text === "string") changes.text = m.changes.text.slice(0, 500);
          if (isValidDate(m.changes.date)) changes.date = m.changes.date;
          if (TIME_RE.test(m.changes.startTime)) changes.startTime = m.changes.startTime;
          if (TIME_RE.test(m.changes.endTime)) changes.endTime = m.changes.endTime;
          mod.changes = changes;
        }
        modifications.push(mod);
      }
    }

    return NextResponse.json({ tasks, events, needsTime, ambiguousTime, modifications });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't organize that. Try again in a moment." },
      { status: 502 }
    );
  }
}
