"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox, Sparkles, Clock, CheckCircle2, Circle, Plus, Moon, X, Loader2,
  ListTree, Trash2, ChevronLeft, ChevronRight, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TOKENS } from "@/lib/theme";
import {
  CATEGORY_LABEL, DAY_NAMES, dateKey, isToday, minsToLabel, scheduleTasks,
} from "@/lib/scheduling";
import {
  fetchTasks, insertTasks, updateTask, deleteTask,
  fetchEventsByDate, insertEvent, deleteEvent,
  fetchRecap, upsertRecap,
} from "@/lib/data";

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

  useEffect(() => {
    (async () => {
      try {
        const [taskRows, events] = await Promise.all([
          fetchTasks(supabase),
          fetchEventsByDate(supabase),
        ]);
        setTasks(taskRows);
        setEventsByDate(events);
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

  const dKey = dateKey(selectedDate);
  const dayEvents = eventsByDate[dKey] || [];
  const scheduled = scheduleTasks(tasks, dayEvents, selectedDate);

  const shiftDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const handleOrganize = useCallback(async () => {
    if (!dump.trim()) return;
    setOrganizing(true);
    setError("");
    try {
      const { tasks: newTaskDrafts } = await postJson("/api/organize", { dump });
      if (newTaskDrafts.length === 0) {
        setError("Didn't find anything actionable in that — try adding a bit more detail.");
        return;
      }
      const inserted = await insertTasks(supabase, userId, newTaskDrafts);
      setTasks((prev) => [...prev, ...inserted]);
      setDump("");
    } catch (e) {
      setError(e.message || "Couldn't organize that. Try again in a moment.");
    } finally {
      setOrganizing(false);
    }
  }, [dump, supabase, userId]);

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

  const toggleTaskDone = async (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const done = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    try {
      await updateTask(supabase, id, { done });
    } catch (e) {
      setError("Couldn't save that change.");
    }
  };

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
    try {
      const saved = await insertEvent(supabase, userId, dKey, draft);
      setEventsByDate((prev) => ({ ...prev, [dKey]: [...(prev[dKey] || []), saved] }));
      setEventText("");
      setEventStart("");
      setEventEnd("");
    } catch (e) {
      setError("Couldn't add that event.");
    }
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

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "var(--font-body), sans-serif", color: TOKENS.ink }}>
      <div className="mx-auto max-w-2xl px-5 py-10">

        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "32px", letterSpacing: "-0.01em", margin: 0 }}>aidhd.</h1>
            <p style={{ color: TOKENS.sub, fontSize: "15px", marginTop: "4px" }}>Hi {name}. Stop thinking. Start doing.</p>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1" style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer", marginTop: "6px" }}>
            <LogOut size={13} /> Sign out
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-center justify-between" style={{ background: TOKENS.overflowBg, color: TOKENS.overflow, borderRadius: "10px", padding: "10px 14px", fontSize: "14px" }}>
            <span>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: TOKENS.overflow, cursor: "pointer" }}><X size={16} /></button>
          </div>
        )}

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

        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Clock size={18} style={{ color: TOKENS.sub }} /><h2 style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>Calendar</h2></div>
            <div className="flex items-center gap-3">
              <button onClick={() => shiftDay(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" }}><ChevronLeft size={18} /></button>
              <span style={{ fontSize: "13px", minWidth: "150px", textAlign: "center" }}>
                {isToday(selectedDate) ? "Today · " : ""}{DAY_NAMES[selectedDate.getDay()]}, {selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <button onClick={() => shiftDay(1)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" }}><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {dayEvents.length === 0 && <p style={{ color: TOKENS.sub, fontSize: "13px", margin: 0 }}>Nothing fixed on this day yet.</p>}
            {dayEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2" style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "999px", padding: "6px 12px", fontSize: "13px" }}>
                <span>{ev.text} · {minsToLabel(ev.start)}–{minsToLabel(ev.end)}</span>
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
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3"><ListTree size={18} style={{ color: TOKENS.sub }} /><h2 style={{ fontSize: "15px", fontWeight: 500, margin: 0 }}>Plan for this day</h2></div>
          {scheduled.length === 0 && <p style={{ color: TOKENS.sub, fontSize: "14px" }}>Nothing yet. Dump something above to get started.</p>}
          <div className="flex flex-col gap-2">
            {scheduled.map((t) => (
              <div key={t.id} style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "12px", padding: "12px 14px" }}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleTaskDone(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: "1px", color: t.done ? TOKENS.calm : TOKENS.sub }}>
                    {t.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span style={{ fontSize: "14px", textDecoration: t.done ? "line-through" : "none", color: t.done ? TOKENS.sub : TOKENS.ink }}>{t.text}</span>
                      <span style={{ fontSize: "11px", background: TOKENS.calmBg, color: TOKENS.calmText, borderRadius: "999px", padding: "2px 8px" }}>{CATEGORY_LABEL[t.category] || t.category}</span>
                      <span style={{ fontSize: "12px", color: TOKENS.sub }}>{t.minutes} min</span>
                      {t.overflow && !t.done && <span style={{ fontSize: "11px", background: TOKENS.overflowBg, color: TOKENS.overflow, borderRadius: "999px", padding: "2px 8px" }}>doesn&apos;t fit this day</span>}
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
                      {(!t.steps || t.steps.length === 0) && (
                        <button onClick={() => handleBreakdown(t)} disabled={breakingId === t.id}
                          style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.now, fontSize: "12px", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                          {breakingId === t.id ? <Loader2 size={12} className="animate-spin" /> : null}
                          {breakingId === t.id ? "Breaking it down" : "Too much? Break it down"}
                        </button>
                      )}
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

      </div>
    </div>
  );
}
