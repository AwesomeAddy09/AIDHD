import React, { useState, useEffect, useCallback } from "react";
import {
  Inbox, Sparkles, Clock, CheckCircle2, Circle, Plus, Moon, X, Loader2,
  ListTree, Trash2, ChevronLeft, ChevronRight, LogOut,
} from "lucide-react";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
`;

const TOKENS = {
  bg: "#F1F3EE",
  card: "#FFFFFF",
  ink: "#20241E",
  sub: "#6D6C61",
  border: "#DEDACC",
  now: "#D98E2B",
  nowBg: "#F7E7C6",
  nowText: "#7A4C13",
  calm: "#3F6B4E",
  calmBg: "#DCE7DC",
  calmText: "#24402E",
  overflow: "#B85433",
  overflowBg: "#F3DDD1",
};

const CATEGORY_LABEL = { work: "Work", personal: "Personal", errand: "Errand", health: "Health", admin: "Admin" };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dateKey(d) { return d.toISOString().slice(0, 10); }
function isToday(d) { return dateKey(d) === dateKey(new Date()); }
function minsToLabel(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("\n");
}
function parseJsonLoose(text) { return JSON.parse(text.replace(/```json|```/g, "").trim()); }

function scheduleTasks(tasks, dayEvents, forDate) {
  const dayEnd = 21 * 60;
  const start = isToday(forDate) ? Math.max(nowMinutes(), 8 * 60) : 8 * 60;
  const sorted = [...dayEvents].sort((a, b) => a.start - b.start);

  let gaps = [[start, dayEnd]];
  for (const ev of sorted) {
    const next = [];
    for (const [gs, ge] of gaps) {
      if (ev.end <= gs || ev.start >= ge) { next.push([gs, ge]); continue; }
      if (ev.start > gs) next.push([gs, ev.start]);
      if (ev.end < ge) next.push([ev.end, ge]);
    }
    gaps = next;
  }
  gaps = gaps.filter(([a, b]) => b - a > 0);

  const undone = tasks.filter((t) => !t.done).sort((a, b) => a.priority - b.priority);
  const done = tasks.filter((t) => t.done);
  const placed = [];
  for (const t of undone) {
    let fit = null;
    for (let i = 0; i < gaps.length; i++) { if (gaps[i][1] - gaps[i][0] >= t.minutes) { fit = i; break; } }
    if (fit === null) { placed.push({ ...t, scheduledStart: null, overflow: true }); continue; }
    const [gs, ge] = gaps[fit];
    placed.push({ ...t, scheduledStart: gs, overflow: false });
    const newStart = gs + t.minutes;
    if (newStart >= ge) gaps.splice(fit, 1); else gaps[fit] = [newStart, ge];
  }
  placed.sort((a, b) => (a.scheduledStart ?? 999999) - (b.scheduledStart ?? 999999));
  return [...placed, ...done];
}

function SignIn({ onSignIn }) {
  const [name, setName] = useState("");
  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{FONTS}</style>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "14px", padding: "32px 28px", width: "320px" }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "28px", margin: "0 0 4px" }}>aidhd.</h1>
        <p style={{ color: TOKENS.sub, fontSize: "14px", margin: "0 0 20px" }}>Stop thinking. Start doing.</p>
        <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", marginBottom: "6px" }}>What should we call you?</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSignIn(name.trim()); }}
          style={{ width: "100%", background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "9px 12px", fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
        <button
          onClick={() => name.trim() && onSignIn(name.trim())}
          disabled={!name.trim()}
          style={{ marginTop: "14px", width: "100%", background: TOKENS.now, color: "#fff", border: "none", borderRadius: "8px", padding: "10px", fontSize: "14px", fontWeight: 500, cursor: name.trim() ? "pointer" : "default", opacity: name.trim() ? 1 : 0.5 }}
        >
          Get started
        </button>
        <p style={{ color: TOKENS.sub, fontSize: "11px", marginTop: "14px", lineHeight: 1.5 }}>
          This is a lightweight demo sign-in stored only on this device. It's not secure account authentication.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState(null);
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
        const p = await window.storage.get("profile");
        if (p && p.value) setProfile(JSON.parse(p.value));
      } catch (e) {}
      try {
        const res = await window.storage.get("aidhd-state");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setTasks(parsed.tasks || []);
          setEventsByDate(parsed.eventsByDate || {});
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !profile) return;
    window.storage.set("aidhd-state", JSON.stringify({ tasks, eventsByDate })).catch(() => {});
  }, [tasks, eventsByDate, loaded, profile]);

  useEffect(() => {
    if (!profile) return;
    const today = new Date().toISOString().slice(0, 10);
    window.storage.get(`recap:${today}`).then((r) => { if (r && r.value) setRecap(r.value); }).catch(() => setRecap(null));
  }, [profile]);

  const handleSignIn = async (name) => {
    const p = { name };
    await window.storage.set("profile", JSON.stringify(p)).catch(() => {});
    setProfile(p);
  };
  const handleSignOut = async () => {
    await window.storage.delete("profile").catch(() => {});
    setProfile(null);
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
    setOrganizing(true); setError("");
    try {
      const text = await callClaude(
        "You are a task organizer inside an ADHD assistant app. Given a raw brain-dump, extract discrete actionable tasks. Return ONLY valid JSON, no markdown fences: an array of objects with keys text, category (work, personal, errand, health, or admin), minutes (integer estimate), priority (1 urgent, 2 normal, 3 low). Do not invent tasks not implied by the input.",
        dump
      );
      const parsed = parseJsonLoose(text);
      const newTasks = parsed.map((t, i) => ({
        id: `t-${Date.now()}-${i}`, text: t.text, category: t.category || "personal",
        minutes: t.minutes || 20, priority: t.priority || 2, done: false, steps: null,
      }));
      setTasks((prev) => [...prev, ...newTasks]);
      setDump("");
    } catch (e) { setError("Couldn't organize that. Try again in a moment."); }
    finally { setOrganizing(false); }
  }, [dump]);

  const handleBreakdown = useCallback(async (task) => {
    setBreakingId(task.id); setError("");
    try {
      const text = await callClaude(
        "You help someone with ADHD who feels stuck starting a task. Return ONLY valid JSON, no markdown fences: an array of 3 to 6 short strings, each a concrete tiny next physical action, ordered, small enough that starting feels easy.",
        task.text
      );
      const parsed = parseJsonLoose(text);
      const steps = parsed.map((s, i) => ({ id: `s-${task.id}-${i}`, text: s, done: false }));
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, steps } : t)));
    } catch (e) { setError("Couldn't break that down. Try again in a moment."); }
    finally { setBreakingId(null); }
  }, []);

  const toggleTaskDone = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const toggleStepDone = (taskId, stepId) => setTasks((prev) => prev.map((t) => {
    if (t.id !== taskId || !t.steps) return t;
    const steps = t.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
    return { ...t, steps, done: steps.every((s) => s.done) };
  }));
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const addEvent = () => {
    if (!eventText.trim() || !eventStart || !eventEnd) return;
    const [sh, sm] = eventStart.split(":").map(Number);
    const [eh, em] = eventEnd.split(":").map(Number);
    setEventsByDate((prev) => ({
      ...prev,
      [dKey]: [...(prev[dKey] || []), { id: `e-${Date.now()}`, text: eventText, start: sh * 60 + sm, end: eh * 60 + em }],
    }));
    setEventText(""); setEventStart(""); setEventEnd("");
  };
  const removeEvent = (id) => setEventsByDate((prev) => ({ ...prev, [dKey]: (prev[dKey] || []).filter((e) => e.id !== id) }));

  const handleRecap = useCallback(async () => {
    setRecapLoading(true); setError("");
    try {
      const completed = tasks.filter((t) => t.done).map((t) => t.text);
      const remaining = tasks.filter((t) => !t.done).map((t) => t.text);
      const text = await callClaude(
        "You write brief, warm, non-judgmental end-of-day recaps for an ADHD productivity app. Write two short paragraphs: first acknowledging today honestly and kindly, no guilt, no hype. Second previewing what's left simply. Plain text only, under 120 words total.",
        `Completed today: ${completed.join(", ") || "nothing marked done"}.\nStill open: ${remaining.join(", ") || "nothing left"}.`
      );
      setRecap(text.trim());
      const today = new Date().toISOString().slice(0, 10);
      await window.storage.set(`recap:${today}`, text.trim());
    } catch (e) { setError("Couldn't put together a recap. Try again in a moment."); }
    finally { setRecapLoading(false); }
  }, [tasks]);

  if (!profile) return <SignIn onSignIn={handleSignIn} />;

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: TOKENS.ink }}>
      <style>{FONTS}</style>
      <div className="mx-auto max-w-2xl px-5 py-10">

        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "32px", letterSpacing: "-0.01em", margin: 0 }}>aidhd.</h1>
            <p style={{ color: TOKENS.sub, fontSize: "15px", marginTop: "4px" }}>Hi {profile.name}. Stop thinking. Start doing.</p>
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
            style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "12px", padding: "14px 16px", fontSize: "14px", minHeight: "100px", color: TOKENS.ink, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
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
              style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "13px", fontFamily: "inherit", width: "140px", outline: "none" }} />
            <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)}
              style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "13px", fontFamily: "inherit", outline: "none" }} />
            <span style={{ color: TOKENS.sub, fontSize: "13px" }}>to</span>
            <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)}
              style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "7px 10px", fontSize: "13px", fontFamily: "inherit", outline: "none" }} />
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
                      {t.overflow && !t.done && <span style={{ fontSize: "11px", background: TOKENS.overflowBg, color: TOKENS.overflow, borderRadius: "999px", padding: "2px 8px" }}>doesn't fit this day</span>}
                      {!t.overflow && !t.done && t.scheduledStart != null && <span style={{ fontSize: "12px", color: TOKENS.sub }}>at {minsToLabel(t.scheduledStart)}</span>}
                    </div>
                    {t.steps && (
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
                      {!t.steps && (
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
            <p style={{ color: TOKENS.sub, fontSize: "14px" }}>End your day here so you don't have to carry it into tonight.</p>
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
