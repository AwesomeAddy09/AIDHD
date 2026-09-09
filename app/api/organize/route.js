import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseJsonLoose } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildPersonalizationContext } from "@/lib/profileContext";

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

function sanitizeChanges(targetType, raw) {
  if (!raw || typeof raw !== "object") return {};
  const changes = {};
  if (typeof raw.text === "string") changes.text = raw.text.slice(0, 500);
  if (targetType === "task") {
    if (VALID_CATEGORIES.has(raw.category)) changes.category = raw.category;
    if (Number.isFinite(raw.minutes)) changes.minutes = Math.max(1, Math.round(raw.minutes));
    if ([1, 2, 3].includes(raw.priority)) changes.priority = raw.priority;
    if (raw.date === null || isValidDate(raw.date)) changes.date = raw.date;
    if (typeof raw.someday === "boolean") changes.someday = raw.someday;
  } else {
    if (isValidDate(raw.date)) changes.date = raw.date;
    if (TIME_RE.test(raw.startTime)) changes.startTime = raw.startTime;
    if (TIME_RE.test(raw.endTime)) changes.endTime = raw.endTime;
  }
  return changes;
}

function minutesToLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
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
      occurrences.push({ text: String(item.text || "").slice(0, 500), date: d, start, end, isRecurring: true });
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

  const allowed = await checkRateLimit(supabase, user.id, "organize", [
    { limit: 8, windowSeconds: 60 },
    { limit: 60, windowSeconds: 86400 },
  ]);
  if (!allowed) {
    return NextResponse.json({ error: "You've hit today's limit for this, try again in a bit." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const dump = body?.dump;
  if (typeof dump !== "string" || !dump.trim()) {
    return NextResponse.json({ error: "Nothing to organize" }, { status: 400 });
  }
  if (dump.length > 6000) {
    return NextResponse.json(
      { error: "That's a lot to sort at once, try a shorter dump" },
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
      .select("id,text,category,minutes,priority,due_date,done,someday")
      .order("created_at", { ascending: true })
      .limit(150),
    supabase
      .from("events")
      .select("id,text,event_date,start_min,end_min")
      .order("event_date", { ascending: true })
      .limit(150),
  ]);

  const taskSummary = (existingTasks || [])
    .map((t) => `- ${t.id}: "${t.text}" (${t.category}, ${t.minutes}min, priority ${t.priority}, due ${t.due_date || "none"}, ${t.done ? "done" : "not done"}${t.someday ? ", in someday" : ""})`)
    .join("\n") || "(none)";
  const eventSummary = (existingEvents || [])
    .map((e) => `- ${e.id}: "${e.text}" on ${e.event_date} from ${String(Math.floor(e.start_min / 60)).padStart(2, "0")}:${String(e.start_min % 60).padStart(2, "0")} to ${String(Math.floor(e.end_min / 60)).padStart(2, "0")}:${String(e.end_min % 60).padStart(2, "0")}`)
    .join("\n") || "(none)";

  const knownTaskIds = new Set((existingTasks || []).map((t) => t.id));
  const knownEventIds = new Set((existingEvents || []).map((e) => e.id));
  const taskLabels = new Map(
    (existingTasks || []).map((t) => [t.id, `${t.text} (due ${t.due_date || "no date"})`])
  );
  const eventLabels = new Map(
    (existingEvents || []).map((e) => [e.id, `${e.text} (${e.event_date}, ${minutesToLabel(e.start_min)} to ${minutesToLabel(e.end_min)})`])
  );

  try {
    const text = await callClaude(
      `You are a task organizer inside an ADHD assistant app. Today is ${dayName}, ${today}.

EXISTING TASKS:
${taskSummary}

EXISTING EVENTS:
${eventSummary}

Given a raw brain-dump, first check whether it refers to changing, completing, or removing one of the EXISTING items above (matching by meaning/description, not exact wording — e.g. "the dentist appointment" matches an existing event about a dentist).
- If exactly one existing item is a confident match, treat it as a modification.
- If it clearly refers to changing/completing/removing something, but TWO OR MORE existing items are plausible matches (similar or ambiguous wording, e.g. two things both called "meeting"), do NOT guess — put it in "clarifications" instead, listing the 2-4 most plausible candidate ids, so the person can pick which one they meant.
- If it sounds like a brand new item instead (no plausible existing match at all), treat it as a new item.

For everything that isn't a modification of an existing item, extract discrete new items and classify each as:
- "event": a specific clock time IS stated, and AM/PM (or an unambiguous context clue like "school", "lunch", typical business hours) makes the meridiem clear.
- "ambiguous_time": a clock time is stated but you genuinely cannot tell AM from PM from context (e.g. "call mom at 3" with nothing else to go on). Do not guess — flag it instead. Only use this when truly ambiguous; most times have enough context to resolve.
- "appointment": sounds like a meeting, call, appointment, or scheduled event, but NO clock time at all is stated (e.g. "dentist appointment tomorrow"). Do not guess a time.
- "recurring": describes a repeating schedule (e.g. "school every day from 8am to 3pm", "work Mon-Fri 9-5"). Needs explicit start and end times.
- "task": a plain flexible to-do with no time concept (e.g. "math homework", "email the landlord").

For each "task" item, also decide someday: true if it reads as low-stakes, vague, or a "nice idea, not a real commitment" rather than something with actual intent to do it soon (e.g. "maybe learn guitar sometime", "look into a new couch eventually", "should really read more"). Use false for anything that sounds like a genuine to-do, which is most tasks — when honestly unsure, prefer false.

Resolve any date reference (today, tomorrow, in a week, next Friday, a specific date, etc.) into an absolute date in YYYY-MM-DD format, relative to today's date above. If a clock time is stated but no date is mentioned, assume the date is today. If an item mentions no date or time at all, set date to null.

Return ONLY valid JSON, no markdown fences: an object with three keys, "items", "modifications", and "clarifications".

"items" is an array of objects, each with:
- type: "task", "event", "ambiguous_time", "appointment", or "recurring"
- text: short description
- category: one of "work", "personal", "errand", "health", "admin" (task and appointment only)
- date: "YYYY-MM-DD" or null
- minutes: integer duration estimate (task only)
- priority: 1 (urgent), 2 (normal), or 3 (low) (task only)
- someday: true or false (task only)
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
- changes: only for "update" — an object with just the fields being changed (task: text/category/minutes/priority/date/someday; event: text/date/startTime/endTime). Set someday true if the person says something like "that's not urgent" or "put X in someday" about an existing task.

"clarifications" is an array of objects, each with:
- targetType: "task" or "event"
- action: "update", "delete", or "complete"
- changes: only for "update" — same shape as above
- candidateIds: array of 2-4 exact id strings from the EXISTING lists above that could plausibly be meant — never invent one

Do not invent items not implied by the input. Do not use em dashes in any text fields.`,
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
        someday: item?.someday === true,
      });
    }

    // Only accept modifications that reference an id we actually sent —
    // never trust an invented or mistyped one.
    const modifications = [];
    for (const m of rawModifications) {
      if (m?.targetType === "task" && knownTaskIds.has(m.id) && ["update", "delete", "complete"].includes(m.action)) {
        const mod = { targetType: "task", id: m.id, action: m.action };
        if (m.action === "update") mod.changes = sanitizeChanges("task", m.changes);
        modifications.push(mod);
      } else if (m?.targetType === "event" && knownEventIds.has(m.id) && ["update", "delete"].includes(m.action)) {
        const mod = { targetType: "event", id: m.id, action: m.action };
        if (m.action === "update") mod.changes = sanitizeChanges("event", m.changes);
        modifications.push(mod);
      }
    }

    // Genuinely ambiguous references — ask which one was meant rather
    // than guessing. Only kept if at least 2 candidates are real ids we
    // actually sent (otherwise there's nothing to choose between).
    const rawClarifications = Array.isArray(parsed?.clarifications) ? parsed.clarifications : [];
    const clarifications = [];
    for (const c of rawClarifications) {
      const targetType = c?.targetType;
      const knownIds = targetType === "task" ? knownTaskIds : targetType === "event" ? knownEventIds : null;
      const labels = targetType === "task" ? taskLabels : eventLabels;
      const validActions = targetType === "task" ? ["update", "delete", "complete"] : ["update", "delete"];
      if (!knownIds || !validActions.includes(c.action) || !Array.isArray(c.candidateIds)) continue;

      const candidates = c.candidateIds
        .filter((id) => knownIds.has(id))
        .slice(0, 4)
        .map((id) => ({ id, label: labels.get(id) }));
      if (candidates.length < 2) continue;

      const entry = { targetType, action: c.action, candidates };
      if (c.action === "update") entry.changes = sanitizeChanges(targetType, c.changes);
      clarifications.push(entry);
    }

    return NextResponse.json({ tasks, events, needsTime, ambiguousTime, modifications, clarifications });
  } catch (e) {
    return NextResponse.json(
      { error: "Couldn't organize that. Try again in a moment." },
      { status: 502 }
    );
  }
}
