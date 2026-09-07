export const CATEGORY_LABEL = {
  work: "Work",
  personal: "Personal",
  errand: "Errand",
  health: "Health",
  admin: "Admin",
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function isToday(d) {
  return dateKey(d) === dateKey(new Date());
}

export function minsToLabel(mins) {
  const h = Math.floor(mins / 60),
    m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function timeStrToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 21 * 60;

// Derives the day's scheduling window from the person's own sleep
// schedule (set during onboarding), falling back to the original
// defaults when a value is missing. Weekday vs. weekend uses whichever
// pair applies to the date being scheduled, not the day it's being
// viewed from.
export function getDayBounds(date, profile) {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const wake = isWeekend ? profile?.weekendWake : profile?.weekdayWake;
  const bed = isWeekend ? profile?.weekendBedtime : profile?.weekdayBedtime;

  const startMin = timeStrToMinutes(wake) ?? DEFAULT_START;
  let endMin = timeStrToMinutes(bed) ?? DEFAULT_END;
  // A bedtime that's earlier in the clock than the wake time (e.g. wake
  // 7am, bed "past midnight") isn't representable as a same-day window
  // here — fall back rather than produce an inverted/empty schedule.
  if (endMin <= startMin) endMin = DEFAULT_END;

  return { startMin, endMin };
}

// A task with no due date has always been eligible for any day (the
// original "whenever" behavior). A task WITH a due date shouldn't appear
// before it — once its date arrives it competes for that day's plan like
// anything else, and still rolls forward if it doesn't fit (see
// CLAUDE.md's shame-free principle).
export function describeDate(dateStrOrDate) {
  const d = typeof dateStrOrDate === "string" ? new Date(dateStrOrDate + "T00:00:00") : dateStrOrDate;
  const key = dateKey(d);
  if (isToday(d)) return "today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === dateKey(tomorrow)) return "tomorrow";
  return `${DAY_NAMES[d.getDay()]}, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function scheduleTasks(tasks, dayEvents, forDate, dayBounds) {
  const { startMin: wakeMin, endMin: dayEnd } = dayBounds || { startMin: DEFAULT_START, endMin: DEFAULT_END };
  const start = isToday(forDate) ? Math.max(nowMinutes(), wakeMin) : wakeMin;
  const forKey = dateKey(forDate);
  const eligible = tasks.filter((t) => !t.dueDate || t.dueDate <= forKey);
  const sorted = [...dayEvents].sort((a, b) => a.start - b.start);

  let gaps = [[start, dayEnd]];
  for (const ev of sorted) {
    const next = [];
    for (const [gs, ge] of gaps) {
      if (ev.end <= gs || ev.start >= ge) {
        next.push([gs, ge]);
        continue;
      }
      if (ev.start > gs) next.push([gs, ev.start]);
      if (ev.end < ge) next.push([ev.end, ge]);
    }
    gaps = next;
  }
  gaps = gaps.filter(([a, b]) => b - a > 0);

  const undone = eligible.filter((t) => !t.done).sort((a, b) => a.priority - b.priority);
  const done = eligible.filter((t) => t.done);
  const placed = [];
  for (const t of undone) {
    let fit = null;
    for (let i = 0; i < gaps.length; i++) {
      if (gaps[i][1] - gaps[i][0] >= t.minutes) {
        fit = i;
        break;
      }
    }
    if (fit === null) {
      placed.push({ ...t, scheduledStart: null, overflow: true });
      continue;
    }
    const [gs, ge] = gaps[fit];
    placed.push({ ...t, scheduledStart: gs, overflow: false });
    const newStart = gs + t.minutes;
    if (newStart >= ge) gaps.splice(fit, 1);
    else gaps[fit] = [newStart, ge];
  }
  placed.sort((a, b) => (a.scheduledStart ?? 999999) - (b.scheduledStart ?? 999999));
  return [...placed, ...done];
}
