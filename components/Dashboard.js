"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Inbox, Sparkles, Clock, CheckCircle2, Circle, Plus, Moon, X, Loader2,
  ListTree, Trash2, ChevronLeft, ChevronRight, LogOut, Play, CalendarDays, CalendarRange, Pencil,
  Settings as SettingsIcon, Mic, SlidersHorizontal, Focus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TOKENS } from "@/lib/theme";
import {
  CATEGORY_LABEL, DAY_NAMES, dateKey, isToday, minsToLabel, scheduleTasks, describeDate,
  timeStrToMinutes, getDayBounds, findOverlaps, pickNextTask,
} from "@/lib/scheduling";
import {
  fetchTasks, insertTasks, updateTask, deleteTask, startTask,
  fetchEventsByDate, insertEvent, insertEvents, updateEvent, deleteEvent,
  fetchRecap, upsertRecap, fetchProfile, upsertProfile,
} from "@/lib/data";
import { computeCategoryMultipliers, applyLearnedEstimates } from "@/lib/learning";
import TimePromptModal from "@/components/TimePromptModal";
import AmPmPromptModal from "@/components/AmPmPromptModal";
import MonthCalendar from "@/components/MonthCalendar";
import DayTimeline from "@/components/DayTimeline";
import EditTaskModal from "@/components/EditTaskModal";
import EditEventModal from "@/components/EditEventModal";
import ClarifyModal from "@/components/ClarifyModal";
import ConflictModal from "@/components/ConflictModal";
import Onboarding from "@/components/Onboarding";
import ReminderPermissionBanner from "@/components/ReminderPermissionBanner";
import {
  notificationsSupported, registerReminderServiceWorker, requestNotificationPermission,
  showReminderNotification, scheduleReminders, clearScheduledReminders, REMINDER_RESCAN_MS,
} from "@/lib/reminders";
import SettingsPanel from "@/components/Settings";
import { pickSettings, applySettingsToDocument, cacheSettings } from "@/lib/settings";
import { playCompletionSound } from "@/lib/sound";

// Three tabs instead of one long scrolling page: seeing everything at
// once tends to overwhelm people with ADHD more than it helps them, so
// only one focused section is on screen at a time.
const TABS = [
  { key: "dump", label: "Dump", icon: Inbox },
  { key: "plan", label: "Plan", icon: ListTree },
  { key: "wind-down", label: "Wind down", icon: Moon },
];

// Shame-free design principle (see CLAUDE.md): someone returning after a
// gap gets a plain, warm acknowledgment — never a pileup of what they
// missed. This is a soft, best-effort signal (per-browser, not synced
// across devices), which is the right tradeoff for something whose only
// job is to avoid making a returning user feel bad.
const RETURN_GAP_MS = 2 * 24 * 60 * 60 * 1000;
const LAST_VISIT_KEY = "aidhd:lastVisit";

// Runs exactly once, at first client render (via useState's lazy
// initializer below) — not repeatedly, and not from an effect. Reads the
// previous visit before overwriting it, in one atomic step.
function checkReturningAfterGap() {
  if (typeof window === "undefined") return false;
  try {
    const last = localStorage.getItem(LAST_VISIT_KEY);
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    if (last && Date.now() - Number(last) >= RETURN_GAP_MS) return true;
  } catch (e) {
    // localStorage unavailable (private mode, etc.) — just skip the nicety.
  }
  return false;
}

// Shown once, ever, the first time someone has a task to look at — sets
// honest expectations for the time-blindness learning feature before it
// has any data to work with (see CLAUDE.md).
const ONBOARDING_SEEN_KEY = "aidhd:seenTimeLearningIntro";

// Shown once, the first time someone adds something with a real time —
// not on sign-in, where the ask would have no context. Per-browser since
// Notification.permission itself is per-browser too.
const REMINDER_PROMPT_SEEN_KEY = "aidhd:seenReminderPrompt";

// Maps the camelCase keys Settings.js works with to their snake_case
// profiles-table columns, for persisting a settings change.
const SETTINGS_DB_COLUMNS = {
  theme: "theme",
  accentColor: "accent_color",
  textSize: "text_size",
  reduceMotion: "reduce_motion",
  completionSoundEnabled: "completion_sound_enabled",
  taskDensity: "task_density",
};

function checkFirstTimeOnboarding() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(ONBOARDING_SEEN_KEY)) return false;
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    return true;
  } catch (e) {
    return false;
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export default function Dashboard({ userId, name }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [tasks, setTasks] = useState([]);
  const [eventsByDate, setEventsByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dump, setDump] = useState("");
  const [organizing, setOrganizing] = useState(false);
  const [breakingId, setBreakingId] = useState(null);
  const [eventText, setEventText] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [recap, setRecap] = useState(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [welcomeBack] = useState(checkReturningAfterGap);
  const [showOnboarding, setShowOnboarding] = useState(checkFirstTimeOnboarding);
  const [calendarView, setCalendarView] = useState("day"); // "day" | "month"
  // Focus mode: deliberately not persisted anywhere (state, localStorage,
  // or the profile) — it's a moment-to-moment "just this one thing right
  // now" toggle, not a standing preference, so it always resets to the
  // full list on a fresh load.
  const [focusMode, setFocusMode] = useState(false);
  const [activeTab, setActiveTab] = useState("dump"); // "dump" | "plan" | "wind-down"
  const [monthDate, setMonthDate] = useState(new Date());
  const [timeQueue, setTimeQueue] = useState([]); // items needing a start/end time
  const [ampmQueue, setAmpmQueue] = useState([]); // items needing AM/PM clarified
  const [editingTask, setEditingTask] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null); // { event, date }
  const [clarifyQueue, setClarifyQueue] = useState([]); // ambiguous edit/delete/complete requests
  const [profile, setProfile] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [editingPreferences, setEditingPreferences] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [conflictPrompt, setConflictPrompt] = useState(null); // { conflicts, date, proceed }

  // Checks a candidate time range against that date's existing events
  // before running `proceed`. Never blocks outright, just makes an
  // overlap a choice instead of a silent double-booking.
  const runWithConflictCheck = useCallback(
    (dateStr, start, end, excludeId, proceed) => {
      const conflicts = findOverlaps(eventsByDate[dateStr] || [], start, end, excludeId);
      if (conflicts.length > 0) {
        setConflictPrompt({ conflicts, date: dateStr, proceed });
        return;
      }
      proceed();
    },
    [eventsByDate]
  );

  useEffect(() => {
    (async () => {
      try {
        const [taskRows, events, profileRow] = await Promise.all([
          fetchTasks(supabase),
          fetchEventsByDate(supabase),
          fetchProfile(supabase),
        ]);
        setTasks(taskRows);
        setEventsByDate(events);
        setProfile(profileRow);
        if (!profileRow || !profileRow.onboardingCompleted) setNeedsOnboarding(true);
        const today = dateKey(new Date());
        const todaysRecap = await fetchRecap(supabase, today);
        if (todaysRecap) setRecap(todaysRecap);
      } catch (e) {
        setError("Couldn't load your data. Try refreshing.");
      } finally {
        setLoaded(true);
      }
    })();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleOnboardingComplete = useCallback(
    async (answers) => {
      let sleep = { weekdayBedtime: null, weekdayWake: null, weekendBedtime: null, weekendWake: null };
      if (answers.sleepAnswer && answers.sleepAnswer.trim()) {
        try {
          sleep = await postJson("/api/onboarding", { answer: answers.sleepAnswer });
        } catch (e) {
          // Best-effort personalization. Not worth blocking on if it fails.
        }
      }
      const patch = {
        weekday_bedtime: sleep.weekdayBedtime,
        weekday_wake: sleep.weekdayWake,
        weekend_bedtime: sleep.weekendBedtime,
        weekend_wake: sleep.weekendWake,
        adhd_type: answers.adhdType ?? null,
        focus_times: answers.focusTimes || null,
        start_difficulty: answers.startDifficulty || null,
        onboarding_completed: true,
      };
      try {
        await upsertProfile(supabase, userId, patch);
      } catch (e) {
        setError("Couldn't save those answers, but you can try again anytime from Preferences.");
      }
      setProfile((prev) => ({
        ...prev,
        weekdayBedtime: patch.weekday_bedtime,
        weekdayWake: patch.weekday_wake,
        weekendBedtime: patch.weekend_bedtime,
        weekendWake: patch.weekend_wake,
        adhdType: patch.adhd_type,
        focusTimes: patch.focus_times,
        startDifficulty: patch.start_difficulty,
        onboardingCompleted: true,
      }));
      setNeedsOnboarding(false);
      setEditingPreferences(false);
    },
    [supabase, userId]
  );

  const dKey = dateKey(selectedDate);
  const dayEvents = eventsByDate[dKey] || [];
  const categoryMultipliers = useMemo(() => computeCategoryMultipliers(tasks), [tasks]);
  const adjustedTasks = useMemo(
    () => applyLearnedEstimates(tasks, categoryMultipliers),
    [tasks, categoryMultipliers]
  );
  const dayBounds = useMemo(() => getDayBounds(selectedDate, profile), [selectedDate, profile]);
  const scheduled = scheduleTasks(adjustedTasks, dayEvents, selectedDate, dayBounds);
  const nextTask = pickNextTask(scheduled);

  // Display/accessibility settings (theme, accent, text size, motion,
  // sound, density) — see lib/settings.js and components/Settings.js.
  // Kept in sync with <html>'s data-* attributes and the localStorage
  // cache every time the underlying profile fields change, not just on
  // first load, so a change made in Settings applies immediately.
  const settings = useMemo(() => pickSettings(profile), [profile]);
  useEffect(() => {
    applySettingsToDocument(settings);
    cacheSettings(settings);
  }, [settings]);

  // Reminders: everything below is client-side only (setTimeout-driven),
  // see lib/reminders.js and public/sw.js for exactly why, and what
  // upgrading to real background push later would involve.
  const swRegistrationRef = useRef(null);
  const reminderTimersRef = useRef(new Map());
  const notifiedReminderKeysRef = useRef(new Set());
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [reminderTick, setReminderTick] = useState(0);

  const remindersEnabled = profile?.remindersEnabled ?? true;
  const reminderLeadMinutes = profile?.reminderLeadMinutes ?? 10;

  useEffect(() => {
    registerReminderServiceWorker().then((reg) => {
      swRegistrationRef.current = reg;
    });
    return () => clearScheduledReminders(reminderTimersRef);
  }, []);

  // Catches items that drift into the scheduling horizon purely from
  // time passing, with no other data change to trigger a re-scan.
  useEffect(() => {
    const id = setInterval(() => setReminderTick((t) => t + 1), REMINDER_RESCAN_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!remindersEnabled) {
      clearScheduledReminders(reminderTimersRef);
      return;
    }

    const items = [];
    for (const [dateStr, evs] of Object.entries(eventsByDate)) {
      const base = new Date(`${dateStr}T00:00:00`).getTime();
      for (const e of evs) {
        items.push({
          key: `event-${e.id}`,
          title: `${e.text} starts in ${reminderLeadMinutes} minute${reminderLeadMinutes === 1 ? "" : "s"}.`,
          startAt: new Date(base + e.start * 60000),
        });
      }
    }

    // Tasks only ever get a real time slot via the day planner's
    // auto-scheduling for *today* specifically (see lib/scheduling.js) —
    // there's no persisted task-level time in the data model otherwise,
    // so that's the only sense in which a task has a "scheduled time" to
    // remind about. Computed independently of whatever day the Plan tab
    // currently has selected, so merely previewing another day never
    // schedules a real reminder for it.
    const todayDate = new Date();
    const todayKeyStr = dateKey(todayDate);
    const todayBounds = getDayBounds(todayDate, profile);
    const todaysSchedule = scheduleTasks(adjustedTasks, eventsByDate[todayKeyStr] || [], todayDate, todayBounds);
    const todayBase = new Date(`${todayKeyStr}T00:00:00`).getTime();
    for (const t of todaysSchedule) {
      if (t.done || t.overflow || t.scheduledStart == null) continue;
      items.push({
        key: `task-${t.id}`,
        title: `${t.text} starts in ${reminderLeadMinutes} minute${reminderLeadMinutes === 1 ? "" : "s"}.`,
        startAt: new Date(todayBase + t.scheduledStart * 60000),
      });
    }

    scheduleReminders({
      items,
      timersRef: reminderTimersRef,
      notifiedKeysRef: notifiedReminderKeysRef,
      leadMinutes: reminderLeadMinutes,
      onFire: (item) => {
        showReminderNotification(swRegistrationRef.current, { key: item.key, title: item.title });
      },
    });
  }, [loaded, remindersEnabled, reminderLeadMinutes, adjustedTasks, eventsByDate, profile, reminderTick]);

  // First time someone adds something with a real time attached, not on
  // sign-in (where it'd have no context). A no-op once permission has
  // already been decided either way, or the banner's already been seen.
  const maybePromptForReminders = useCallback(() => {
    if (!remindersEnabled || !notificationsSupported() || Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(REMINDER_PROMPT_SEEN_KEY)) return;
    } catch (e) {
      return;
    }
    setShowReminderBanner(true);
  }, [remindersEnabled]);

  const handleAllowReminders = async () => {
    setShowReminderBanner(false);
    try {
      localStorage.setItem(REMINDER_PROMPT_SEEN_KEY, "1");
    } catch (e) {
      // Private mode etc. — worst case the banner just shows again next time.
    }
    await requestNotificationPermission();
  };

  const handleDismissReminderBanner = () => {
    setShowReminderBanner(false);
    try {
      localStorage.setItem(REMINDER_PROMPT_SEEN_KEY, "1");
    } catch (e) {
      // Private mode etc. — worst case the banner just shows again next time.
    }
  };

  const handleUpdateReminderSettings = useCallback(
    async (patch) => {
      setProfile((prev) => ({
        ...prev,
        ...(patch.reminders_enabled !== undefined && { remindersEnabled: patch.reminders_enabled }),
        ...(patch.reminder_lead_minutes !== undefined && { reminderLeadMinutes: patch.reminder_lead_minutes }),
      }));
      try {
        await upsertProfile(supabase, userId, patch);
      } catch (e) {
        setError("Couldn't save that setting.");
      }
    },
    [supabase, userId]
  );

  const handleUpdateSettings = useCallback(
    async (patch) => {
      setProfile((prev) => ({ ...prev, ...patch }));
      const dbPatch = {};
      for (const [key, value] of Object.entries(patch)) {
        const column = SETTINGS_DB_COLUMNS[key];
        if (column) dbPatch[column] = value;
      }
      try {
        await upsertProfile(supabase, userId, dbPatch);
      } catch (e) {
        setError("Couldn't save that setting.");
      }
    },
    [supabase, userId]
  );

  const shiftDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const applyModifications = useCallback(
    async (mods) => {
      for (const mod of mods) {
        try {
          if (mod.targetType === "task") {
            if (mod.action === "delete") {
              await deleteTask(supabase, mod.id);
              setTasks((prev) => prev.filter((t) => t.id !== mod.id));
            } else if (mod.action === "complete") {
              const task = tasks.find((t) => t.id === mod.id);
              let actualMinutes = task?.actualMinutes;
              if (task?.startedAt) {
                actualMinutes = Math.max(1, Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000));
              }
              await updateTask(supabase, mod.id, {
                done: true,
                actual_minutes: actualMinutes,
                completed_at: new Date().toISOString(),
              });
              setTasks((prev) => prev.map((t) => (t.id === mod.id ? { ...t, done: true, actualMinutes } : t)));
            } else if (mod.action === "update") {
              const c = mod.changes || {};
              const patch = {};
              if (c.text !== undefined) patch.text = c.text;
              if (c.category !== undefined) patch.category = c.category;
              if (c.minutes !== undefined) patch.minutes = c.minutes;
              if (c.priority !== undefined) patch.priority = c.priority;
              if (c.date !== undefined) patch.due_date = c.date;
              await updateTask(supabase, mod.id, patch);
              setTasks((prev) => prev.map((t) => {
                if (t.id !== mod.id) return t;
                return {
                  ...t,
                  ...(c.text !== undefined && { text: c.text }),
                  ...(c.category !== undefined && { category: c.category }),
                  ...(c.minutes !== undefined && { minutes: c.minutes }),
                  ...(c.priority !== undefined && { priority: c.priority }),
                  ...(c.date !== undefined && { dueDate: c.date }),
                };
              }));
            }
          } else if (mod.targetType === "event") {
            if (mod.action === "delete") {
              await deleteEvent(supabase, mod.id);
              setEventsByDate((prev) => {
                const next = {};
                for (const [date, evs] of Object.entries(prev)) next[date] = evs.filter((e) => e.id !== mod.id);
                return next;
              });
            } else if (mod.action === "update") {
              const c = mod.changes || {};
              const patch = {};
              if (c.text !== undefined) patch.text = c.text;
              if (c.date !== undefined) patch.event_date = c.date;
              if (c.startTime !== undefined) patch.start_min = timeStrToMinutes(c.startTime);
              if (c.endTime !== undefined) patch.end_min = timeStrToMinutes(c.endTime);
              await updateEvent(supabase, mod.id, patch);
              setEventsByDate((prev) => {
                let oldDate = null;
                for (const [date, evs] of Object.entries(prev)) {
                  if (evs.some((e) => e.id === mod.id)) { oldDate = date; break; }
                }
                if (oldDate === null) return prev;
                const oldEvent = prev[oldDate].find((e) => e.id === mod.id);
                const updatedEvent = {
                  ...oldEvent,
                  ...(c.text !== undefined && { text: c.text }),
                  ...(c.startTime !== undefined && { start: timeStrToMinutes(c.startTime) }),
                  ...(c.endTime !== undefined && { end: timeStrToMinutes(c.endTime) }),
                };
                const newDate = c.date !== undefined ? c.date : oldDate;
                const next = { ...prev };
                next[oldDate] = next[oldDate].filter((e) => e.id !== mod.id);
                next[newDate] = [...(next[newDate] || []), updatedEvent];
                return next;
              });
            }
          }
        } catch (e) {
          setError("Couldn't apply one of the changes.");
        }
      }
    },
    [tasks, supabase]
  );

  const handleOrganize = useCallback(async () => {
    if (!dump.trim()) return;
    setOrganizing(true);
    setError("");
    setNotice("");
    try {
      const {
        tasks: newTaskDrafts,
        events: newEventDrafts,
        needsTime: newNeedsTime,
        ambiguousTime: newAmbiguousTime,
        modifications,
        clarifications,
      } = await postJson("/api/organize", { dump, today: dateKey(new Date()) });

      if (
        newTaskDrafts.length === 0 &&
        newEventDrafts.length === 0 &&
        newNeedsTime.length === 0 &&
        newAmbiguousTime.length === 0 &&
        modifications.length === 0 &&
        clarifications.length === 0
      ) {
        setError("Didn't find anything actionable in that. Try adding a bit more detail.");
        return;
      }

      if (modifications.length > 0) {
        await applyModifications(modifications);
      }
      if (clarifications.length > 0) {
        setClarifyQueue((prev) => [...prev, ...clarifications]);
      }

      if (newTaskDrafts.length > 0) {
        const inserted = await insertTasks(supabase, userId, newTaskDrafts);
        setTasks((prev) => [...prev, ...inserted]);
      }

      const todayKey = dateKey(new Date());
      const laterDates = new Set();

      if (newEventDrafts.length > 0) {
        const saved = await insertEvents(supabase, userId, newEventDrafts);
        const savedByDate = {};
        for (const ev of saved) {
          (savedByDate[ev.date] ??= []).push(ev);
          if (ev.date !== todayKey) laterDates.add(ev.date);
        }
        setEventsByDate((prev) => {
          const next = { ...prev };
          for (const [date, evs] of Object.entries(savedByDate)) {
            next[date] = [...(next[date] || []), ...evs];
          }
          return next;
        });
        maybePromptForReminders();
      }
      for (const t of newTaskDrafts) {
        if (t.date && t.date !== todayKey) laterDates.add(t.date);
      }

      // A fixed-time event landing on the calendar should always be
      // confirmed, not just when it's scheduled for a day other than
      // today (which also needs its own callout, since it won't show up
      // on today's plan and shouldn't look like it silently vanished).
      const noticeParts = [];
      if (newEventDrafts.length === 1) {
        noticeParts.push(`Added "${newEventDrafts[0].text}" to your calendar.`);
      } else if (newEventDrafts.length > 1) {
        noticeParts.push(`Added ${newEventDrafts.length} things to your calendar.`);
      }
      if (laterDates.size > 0) {
        const sorted = [...laterDates].sort();
        const list =
          sorted.length > 5
            ? `${sorted.length} days, starting ${describeDate(sorted[0])}`
            : sorted.length === 1
              ? describeDate(sorted[0])
              : `${sorted.slice(0, -1).map(describeDate).join(", ")} and ${describeDate(sorted[sorted.length - 1])}`;
        noticeParts.push(`Some of this is scheduled for ${list}.`);
      }
      if (noticeParts.length > 0) setNotice(noticeParts.join(" "));

      if (newNeedsTime.length > 0) {
        setTimeQueue((prev) => [...prev, ...newNeedsTime]);
      }
      if (newAmbiguousTime.length > 0) {
        setAmpmQueue((prev) => [...prev, ...newAmbiguousTime]);
      }

      setDump("");
      // Jump to the tab that actually shows what just happened, instead
      // of leaving the result a tab away.
      setActiveTab("plan");
    } catch (e) {
      setError(e.message || "Couldn't organize that. Try again in a moment.");
    } finally {
      setOrganizing(false);
    }
  }, [dump, supabase, userId, applyModifications, maybePromptForReminders]);

  const handleTimePromptSave = useCallback(
    async ({ start, end }) => {
      const item = timeQueue[0];
      if (!item) return;
      setTimeQueue((prev) => prev.slice(1));
      const doInsert = async () => {
        try {
          const saved = await insertEvent(supabase, userId, item.date, { text: item.text, start, end });
          setEventsByDate((prev) => ({ ...prev, [item.date]: [...(prev[item.date] || []), saved] }));
          setNotice(`Added "${item.text}" to your calendar for ${describeDate(item.date)}.`);
          maybePromptForReminders();
        } catch (e) {
          setError("Couldn't add that to the calendar.");
        }
      };
      runWithConflictCheck(item.date, start, end, null, doInsert);
    },
    [timeQueue, supabase, userId, runWithConflictCheck, maybePromptForReminders]
  );

  const handleTimePromptSkip = useCallback(async () => {
    const item = timeQueue[0];
    if (!item) return;
    setTimeQueue((prev) => prev.slice(1));
    try {
      const inserted = await insertTasks(supabase, userId, [
        { text: item.text, category: "personal", minutes: 20, priority: 2, date: item.date },
      ]);
      setTasks((prev) => [...prev, ...inserted]);
      setNotice(`Kept "${item.text}" as a task without a set time.`);
    } catch (e) {
      setError("Couldn't save that.");
    }
  }, [timeQueue, supabase, userId]);

  const handleAmPmChoose = useCallback(
    async (ampm) => {
      const item = ampmQueue[0];
      if (!item) return;
      setAmpmQueue((prev) => prev.slice(1));
      let hour24 = item.hour % 12;
      if (ampm === "PM") hour24 += 12;
      const start = hour24 * 60 + item.minute;
      const end = start + 60;
      const doInsert = async () => {
        try {
          const saved = await insertEvent(supabase, userId, item.date, { text: item.text, start, end });
          setEventsByDate((prev) => ({ ...prev, [item.date]: [...(prev[item.date] || []), saved] }));
          setNotice(`Added "${item.text}" to your calendar for ${describeDate(item.date)}.`);
          maybePromptForReminders();
        } catch (e) {
          setError("Couldn't add that to the calendar.");
        }
      };
      runWithConflictCheck(item.date, start, end, null, doInsert);
    },
    [ampmQueue, supabase, userId, runWithConflictCheck, maybePromptForReminders]
  );

  const handleAmPmSkip = useCallback(() => {
    setAmpmQueue((prev) => prev.slice(1));
  }, []);

  const handleClarifyChoose = useCallback(
    async (candidateId) => {
      const item = clarifyQueue[0];
      if (!item) return;
      setClarifyQueue((prev) => prev.slice(1));
      await applyModifications([{
        targetType: item.targetType,
        id: candidateId,
        action: item.action,
        changes: item.changes,
      }]);
    },
    [clarifyQueue, applyModifications]
  );

  const handleClarifySkip = useCallback(() => {
    setClarifyQueue((prev) => prev.slice(1));
  }, []);

  const handleSaveTaskEdit = useCallback(
    async (changes) => {
      if (!editingTask) return;
      const id = editingTask.id;
      setEditingTask(null);
      try {
        await updateTask(supabase, id, changes);
        setTasks((prev) => prev.map((t) => (t.id === id ? {
          ...t,
          text: changes.text,
          category: changes.category,
          minutes: changes.minutes,
          priority: changes.priority,
          dueDate: changes.due_date,
        } : t)));
      } catch (e) {
        setError("Couldn't save those changes.");
      }
    },
    [editingTask, supabase]
  );

  const handleSaveEventEdit = useCallback(
    async ({ text, date, start, end }) => {
      if (!editingEvent) return;
      const id = editingEvent.event.id;
      const oldDate = editingEvent.date;
      setEditingEvent(null);
      const doUpdate = async () => {
        try {
          await updateEvent(supabase, id, { text, event_date: date, start_min: start, end_min: end });
          setEventsByDate((prev) => {
            const next = { ...prev };
            next[oldDate] = (next[oldDate] || []).filter((e) => e.id !== id);
            next[date] = [...(next[date] || []), { id, text, start, end, isRecurring: editingEvent.event.isRecurring }];
            return next;
          });
          maybePromptForReminders();
        } catch (e) {
          setError("Couldn't save those changes.");
        }
      };
      runWithConflictCheck(date, start, end, id, doUpdate);
    },
    [editingEvent, supabase, runWithConflictCheck, maybePromptForReminders]
  );

  const handleBreakdown = useCallback(
    async (task) => {
      setBreakingId(task.id);
      setError("");
      try {
        const { steps: stepTexts } = await postJson("/api/breakdown", { taskText: task.text });
        const steps = stepTexts.map((s, i) => ({ id: `s-${task.id}-${i}`, text: s, done: false }));
        await updateTask(supabase, task.id, { steps });
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, steps } : t)));
      } catch (e) {
        setError(e.message || "Couldn't break that down. Try again in a moment.");
      } finally {
        setBreakingId(null);
      }
    },
    [supabase]
  );

  const handleStartTask = async (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, startedAt: new Date().toISOString() } : t)));
    try {
      await startTask(supabase, id);
    } catch (e) {
      setError("Couldn't mark that as started.");
    }
  };

  const toggleTaskDone = useCallback(
    async (id) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const done = !task.done;

      // Only a task the person actually started contributes a real timing
      // data point — marking done without starting stays exactly as
      // frictionless as before, it just doesn't teach the app anything.
      let actualMinutes = task.actualMinutes;
      if (done && task.startedAt) {
        const elapsedMs = Date.now() - new Date(task.startedAt).getTime();
        actualMinutes = Math.max(1, Math.round(elapsedMs / 60000));
      }
      const completedAt = done ? new Date().toISOString() : null;

      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done, actualMinutes } : t)));
      if (done && settings.completionSoundEnabled) playCompletionSound();

      try {
        await updateTask(supabase, id, {
          done,
          actual_minutes: actualMinutes,
          completed_at: completedAt,
        });
      } catch (e) {
        setError("Couldn't save that change.");
      }
    },
    [tasks, supabase, settings.completionSoundEnabled]
  );

  const toggleStepDone = async (taskId, stepId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.steps) return;
    const steps = task.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
    const done = steps.every((s) => s.done);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, steps, done } : t)));
    try {
      await updateTask(supabase, taskId, { steps, done });
    } catch (e) {
      setError("Couldn't save that change.");
    }
  };

  const removeTask = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTask(supabase, id);
    } catch (e) {
      setError("Couldn't remove that task.");
    }
  };

  const addEvent = async () => {
    if (!eventText.trim() || !eventStart || !eventEnd) return;
    const [sh, sm] = eventStart.split(":").map(Number);
    const [eh, em] = eventEnd.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (end <= start) {
      setError("End time needs to be after the start time.");
      return;
    }
    const draft = { text: eventText, start, end };
    const doInsert = async () => {
      try {
        const saved = await insertEvent(supabase, userId, dKey, draft);
        setEventsByDate((prev) => ({ ...prev, [dKey]: [...(prev[dKey] || []), saved] }));
        setEventText("");
        setEventStart("");
        setEventEnd("");
        maybePromptForReminders();
      } catch (e) {
        setError("Couldn't add that event.");
      }
    };
    runWithConflictCheck(dKey, start, end, null, doInsert);
  };

  const removeEvent = async (id) => {
    setEventsByDate((prev) => ({ ...prev, [dKey]: (prev[dKey] || []).filter((e) => e.id !== id) }));
    try {
      await deleteEvent(supabase, id);
    } catch (e) {
      setError("Couldn't remove that event.");
    }
  };

  const handleRecap = useCallback(async () => {
    setRecapLoading(true);
    setError("");
    try {
      const completed = tasks.filter((t) => t.done).map((t) => t.text);
      const remaining = tasks.filter((t) => !t.done).map((t) => t.text);
      const { recap: text } = await postJson("/api/recap", { completed, remaining });
      setRecap(text);
      await upsertRecap(supabase, userId, dateKey(new Date()), text);
    } catch (e) {
      setError(e.message || "Couldn't put together a recap. Try again in a moment.");
    } finally {
      setRecapLoading(false);
    }
  }, [tasks, supabase, userId]);

  if (!loaded) {
    return (
      <div
        style={{
          background: TOKENS.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: TOKENS.sub,
        }}
      >
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <Onboarding name={name} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "var(--font-body), sans-serif", color: TOKENS.ink }}>
      <div className="mx-auto max-w-2xl px-5 pt-10" style={{ paddingBottom: "96px" }}>

        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "32px", letterSpacing: "-0.01em", margin: 0 }}>aidhd.</h1>
            <p style={{ color: TOKENS.sub, fontSize: "15px", marginTop: "4px" }}>
              {welcomeBack
                ? `Welcome back, ${name}. No need to catch up on everything at once, just pick up wherever feels right.`
                : `Stop thinking. Start doing.`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2" style={{ marginTop: "6px" }}>
            <Link href="/recorder" className="flex items-center gap-1" style={{ color: TOKENS.sub, fontSize: "12px", textDecoration: "none" }}>
              <Mic size={13} /> Lesson Recorder
            </Link>
            <button onClick={() => setEditingPreferences(true)} className="flex items-center gap-1" style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer" }}>
              <SettingsIcon size={13} /> Preferences
            </button>
            <button onClick={() => setEditingSettings(true)} className="flex items-center gap-1" style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer" }}>
              <SlidersHorizontal size={13} /> Settings
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-1" style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer" }}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center justify-between" style={{ background: TOKENS.overflowBg, color: TOKENS.overflow, borderRadius: "10px", padding: "10px 14px", fontSize: "14px" }}>
            <span>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: TOKENS.overflow, cursor: "pointer" }}><X size={16} /></button>
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-center justify-between" style={{ background: TOKENS.calmBg, color: TOKENS.calmText, borderRadius: "10px", padding: "10px 14px", fontSize: "14px" }}>
            <span>{notice}</span>
            <button onClick={() => setNotice("")} style={{ background: "none", border: "none", color: TOKENS.calmText, cursor: "pointer" }}><X size={16} /></button>
          </div>
        )}

        {showReminderBanner && (
          <ReminderPermissionBanner onAllow={handleAllowReminders} onDismiss={handleDismissReminderBanner} />
        )}

        {showOnboarding && (
          <div className="mb-6 flex items-start justify-between gap-3" style={{ background: TOKENS.neutralBg, color: TOKENS.ink, borderRadius: "10px", padding: "12px 14px", fontSize: "13px", lineHeight: 1.5 }}>
            <span>
              One thing worth knowing: aidhd gets better at estimating how long things take <em>you</em> specifically, the more you use it. For the first couple of weeks it&apos;s just learning. Treat early estimates as a first guess, not a verdict.
            </span>
            <button onClick={() => setShowOnboarding(false)} style={{ background: "none", border: "none", color: TOKENS.neutralText, cursor: "pointer", flexShrink: 0 }}><X size={16} /></button>
          </div>
        )}

        {activeTab === "dump" && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3"><Inbox size={18} style={{ color: TOKENS.sub }} /><h2 style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>Dump it here</h2></div>
          <textarea
            value={dump} onChange={(e) => setDump(e.target.value)}
            placeholder="Everything on your mind. Emails to send, errands, that thing you keep forgetting. Don't organize it, just dump it."
            className="w-full"
            style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "12px", padding: "14px 16px", fontSize: "16px", minHeight: "100px", color: TOKENS.ink, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
          <button onClick={handleOrganize} disabled={organizing || !dump.trim()} className="mt-3 flex items-center gap-2"
            style={{ background: TOKENS.now, color: "#fff", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", fontWeight: 500, cursor: organizing ? "default" : "pointer", opacity: !dump.trim() ? 0.5 : 1 }}>
            {organizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {organizing ? "Sorting it out" : "Sort it out"}
          </button>
        </section>
        )}

        {activeTab === "plan" && (
        <>
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Clock size={18} style={{ color: TOKENS.sub }} /><h2 style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>Calendar</h2></div>
            <div className="flex items-center gap-3">
              {calendarView === "day" && (
                <>
                  <button onClick={() => shiftDay(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" }}><ChevronLeft size={18} /></button>
                  <span style={{ fontSize: "13px", minWidth: "150px", textAlign: "center" }}>
                    {isToday(selectedDate) ? "Today · " : ""}{DAY_NAMES[selectedDate.getDay()]}, {selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <button onClick={() => shiftDay(1)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" }}><ChevronRight size={18} /></button>
                </>
              )}
              <button
                onClick={() => {
                  if (calendarView === "day") {
                    setMonthDate(selectedDate);
                    setCalendarView("month");
                  } else {
                    setCalendarView("day");
                  }
                }}
                title={calendarView === "day" ? "Month view" : "Day view"}
                style={{ background: "none", border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "5px 8px", cursor: "pointer", color: TOKENS.ink, display: "flex", alignItems: "center" }}
              >
                {calendarView === "day" ? <CalendarRange size={16} /> : <CalendarDays size={16} />}
              </button>
            </div>
          </div>

          {calendarView === "month" ? (
            <MonthCalendar
              monthDate={monthDate}
              onChangeMonth={(delta) => setMonthDate((prev) => {
                const d = new Date(prev);
                d.setMonth(d.getMonth() + delta);
                return d;
              })}
              eventsByDate={eventsByDate}
              tasks={tasks}
              onSelectDay={(d) => {
                setSelectedDate(d);
                setCalendarView("day");
              }}
            />
          ) : (
            <>
              <div className="mb-4" style={{ border: `1px solid ${TOKENS.border}`, borderRadius: "10px", overflow: "auto", maxHeight: "420px" }}>
                <DayTimeline
                  date={selectedDate}
                  events={dayEvents}
                  tasks={scheduled}
                  onSelectEvent={(ev) => setEditingEvent({ event: ev, date: dKey })}
                  onSelectTask={(t) => setEditingTask(t)}
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {dayEvents.length === 0 && <p style={{ color: TOKENS.sub, fontSize: "13px", margin: 0 }}>Nothing fixed on this day yet.</p>}
                {dayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2" style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "999px", padding: "6px 12px", fontSize: "13px" }}>
                    <span>{ev.text} · {minsToLabel(ev.start)}–{minsToLabel(ev.end)}</span>
                    <button onClick={() => setEditingEvent({ event: ev, date: dKey })} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" }}><Pencil size={12} /></button>
                    <button onClick={() => removeEvent(ev.id)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" }}><X size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input value={eventText} onChange={(e) => setEventText(e.target.value)} placeholder="e.g. Dentist"
                  style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "16px", fontFamily: "inherit", width: "140px", outline: "none" }} />
                <div className="flex items-center gap-2" style={{ flexWrap: "nowrap" }}>
                  <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)}
                    style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "16px", fontFamily: "inherit", outline: "none" }} />
                  <span style={{ color: TOKENS.sub, fontSize: "13px" }}>to</span>
                  <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)}
                    style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "16px", fontFamily: "inherit", outline: "none" }} />
                </div>
                <button onClick={addEvent} className="flex items-center gap-1" style={{ background: "none", border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 12px", fontSize: "13px", cursor: "pointer", color: TOKENS.ink }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </>
          )}
        </section>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListTree size={18} style={{ color: TOKENS.sub }} />
              <h2 style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>Plan for this day</h2>
            </div>
            <button
              onClick={() => setFocusMode((v) => !v)}
              className="flex items-center gap-1"
              style={{
                background: focusMode ? TOKENS.now : TOKENS.neutralBg,
                color: focusMode ? "#fff" : TOKENS.sub,
                border: "none", borderRadius: "999px", padding: "6px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
              }}
            >
              <Focus size={14} /> {focusMode ? "Show full list" : "Focus mode"}
            </button>
          </div>
          {(focusMode ? !nextTask : scheduled.length === 0) && (
            <p style={{ color: TOKENS.sub, fontSize: "14px" }}>
              {focusMode ? "Nothing to focus on right now." : "Nothing yet. Dump something above to get started."}
            </p>
          )}
          <div className="flex flex-col" style={{ gap: settings.taskDensity === "compact" ? "6px" : "10px" }}>
            {(focusMode ? (nextTask ? [nextTask] : []) : scheduled).map((t) => (
              <div key={t.id} style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "12px", padding: settings.taskDensity === "compact" ? "8px 12px" : "12px 14px" }}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleTaskDone(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: "1px", color: t.done ? TOKENS.calm : TOKENS.sub }}>
                    {t.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span style={{ fontSize: "14px", textDecoration: t.done ? "line-through" : "none", color: t.done ? TOKENS.sub : TOKENS.ink }}>{t.text}</span>
                      <span style={{ fontSize: "11px", background: TOKENS.calmBg, color: TOKENS.calmText, borderRadius: "999px", padding: "2px 8px" }}>{CATEGORY_LABEL[t.category] || t.category}</span>
                      {t.dueDate && (
                        <span style={{ fontSize: "11px", background: TOKENS.nowBg, color: TOKENS.nowText, borderRadius: "999px", padding: "2px 8px" }}>due {describeDate(t.dueDate)}</span>
                      )}
                      <span style={{ fontSize: "12px", color: TOKENS.sub }}>{t.minutes} min</span>
                      {t.rawMinutes != null && (
                        <span style={{ fontSize: "12px", color: TOKENS.sub, fontStyle: "italic" }}>usually closer to {t.minutes} min for you</span>
                      )}
                      {t.startedAt && !t.done && (
                        <span style={{ fontSize: "11px", background: TOKENS.neutralBg, color: TOKENS.neutralText, borderRadius: "999px", padding: "2px 8px" }}>in progress</span>
                      )}
                      {t.overflow && !t.done && <span style={{ fontSize: "11px", background: TOKENS.neutralBg, color: TOKENS.neutralText, borderRadius: "999px", padding: "2px 8px" }}>rolls to another day</span>}
                      {!t.overflow && !t.done && t.scheduledStart != null && <span style={{ fontSize: "12px", color: TOKENS.sub }}>at {minsToLabel(t.scheduledStart)}</span>}
                    </div>
                    {t.steps && t.steps.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {t.steps.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <button onClick={() => toggleStepDone(t.id, s.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: s.done ? TOKENS.calm : TOKENS.sub }}>
                              {s.done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            </button>
                            <span style={{ fontSize: "13px", textDecoration: s.done ? "line-through" : "none", color: s.done ? TOKENS.sub : TOKENS.ink }}>{s.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {!t.done && !t.startedAt && (
                        <button onClick={() => handleStartTask(t.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.calm, fontSize: "12px", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                          <Play size={12} /> Start
                        </button>
                      )}
                      {(!t.steps || t.steps.length === 0) && (
                        <button onClick={() => handleBreakdown(t)} disabled={breakingId === t.id}
                          style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.now, fontSize: "12px", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                          {breakingId === t.id ? <Loader2 size={12} className="animate-spin" /> : null}
                          {breakingId === t.id ? "Breaking it down" : "Too much? Break it down"}
                        </button>
                      )}
                      <button onClick={() => setEditingTask(t)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, fontSize: "12px", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => removeTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, fontSize: "12px", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        </>
        )}

        {activeTab === "wind-down" && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3"><Moon size={18} style={{ color: TOKENS.sub }} /><h2 style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>Wind down</h2></div>
          {recap ? (
            <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "12px", padding: "16px 18px", fontSize: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{recap}</div>
          ) : (
            <p style={{ color: TOKENS.sub, fontSize: "14px" }}>End your day here so you don&apos;t have to carry it into tonight.</p>
          )}
          <button onClick={handleRecap} disabled={recapLoading} className="mt-3 flex items-center gap-2"
            style={{ background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px 18px", fontSize: "14px", cursor: recapLoading ? "default" : "pointer" }}>
            {recapLoading ? <Loader2 size={16} className="animate-spin" /> : <Moon size={16} />}
            {recapLoading ? "Writing your recap" : "Wrap up my day"}
          </button>
        </section>
        )}

        <footer style={{ textAlign: "center", paddingTop: "8px" }}>
          <a href="/privacy" style={{ color: TOKENS.sub, fontSize: "12px", textDecoration: "none" }}>Privacy</a>
        </footer>

      </div>

      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: TOKENS.card, borderTop: `1px solid ${TOKENS.border}`,
          zIndex: 40, paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="mx-auto max-w-2xl flex">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex flex-col items-center"
              style={{
                flex: 1, gap: "3px", background: "none", border: "none", cursor: "pointer",
                color: activeTab === key ? TOKENS.now : TOKENS.sub, padding: "10px 0",
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: "11px", fontWeight: activeTab === key ? 500 : 400 }}>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {timeQueue.length > 0 && (
        <TimePromptModal
          item={timeQueue[0]}
          onSave={handleTimePromptSave}
          onSkip={handleTimePromptSkip}
        />
      )}

      {ampmQueue.length > 0 && (
        <AmPmPromptModal
          item={ampmQueue[0]}
          onChoose={handleAmPmChoose}
          onSkip={handleAmPmSkip}
        />
      )}

      {clarifyQueue.length > 0 && (
        <ClarifyModal
          item={clarifyQueue[0]}
          onChoose={handleClarifyChoose}
          onSkip={handleClarifySkip}
        />
      )}

      {editingPreferences && (
        <Onboarding
          name={name}
          isEdit
          initialProfile={profile}
          onComplete={handleOnboardingComplete}
          onCancel={() => setEditingPreferences(false)}
          remindersEnabled={remindersEnabled}
          reminderLeadMinutes={reminderLeadMinutes}
          onUpdateReminderSettings={handleUpdateReminderSettings}
        />
      )}

      {editingSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={handleUpdateSettings}
          onClose={() => setEditingSettings(false)}
        />
      )}

      {conflictPrompt && (
        <ConflictModal
          conflicts={conflictPrompt.conflicts}
          onAddAnyway={() => {
            const proceed = conflictPrompt.proceed;
            setConflictPrompt(null);
            proceed();
          }}
          onDontAdd={() => setConflictPrompt(null)}
          onGoToCalendar={() => {
            const targetDate = conflictPrompt.date;
            setConflictPrompt(null);
            setActiveTab("plan");
            setCalendarView("day");
            setSelectedDate(new Date(targetDate + "T00:00:00"));
          }}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onSave={handleSaveTaskEdit}
          onCancel={() => setEditingTask(null)}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent.event}
          date={editingEvent.date}
          onSave={handleSaveEventEdit}
          onCancel={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
