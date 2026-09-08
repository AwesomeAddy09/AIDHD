"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { TOKENS } from "@/lib/theme";
import { minsToLabel } from "@/lib/scheduling";

const QUESTIONS = [
  {
    key: "sleepAnswer",
    type: "sleep",
    prompt: "What time do you usually go to bed and wake up on weekdays? What about weekends?",
    placeholder: "e.g. weekdays I'm up around 7 and asleep by 11. Weekends are all over the place.",
    hint: "This just shifts when your day's plan starts and ends to match your actual schedule.",
  },
  {
    key: "adhdType",
    type: "scale",
    prompt: "Where would you place yourself: more inattentive, more hyperactive, or a mix?",
    hint: "No wrong answer here, and it's fine to guess.",
  },
  {
    key: "focusTimes",
    type: "text",
    prompt: "When during the day do you usually feel most focused or have the most energy?",
    placeholder: "e.g. mornings, right after coffee. Or: idk, it varies a lot.",
  },
  {
    key: "startDifficulty",
    type: "text",
    prompt: "What usually makes it hardest to actually start a task?",
    placeholder: "e.g. I don't know where to begin. Or: getting distracted before I even start.",
  },
];

function synthesizeSleepText(profile) {
  if (!profile) return "";
  const parts = [];
  if (profile.weekdayWake || profile.weekdayBedtime) {
    parts.push(`Weekdays: up around ${profile.weekdayWake ? minsToLabel(toMin(profile.weekdayWake)) : "?"}, asleep around ${profile.weekdayBedtime ? minsToLabel(toMin(profile.weekdayBedtime)) : "?"}.`);
  }
  if (profile.weekendWake || profile.weekendBedtime) {
    parts.push(`Weekends: up around ${profile.weekendWake ? minsToLabel(toMin(profile.weekendWake)) : "?"}, asleep around ${profile.weekendBedtime ? minsToLabel(toMin(profile.weekendBedtime)) : "?"}.`);
  }
  return parts.join(" ");
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const LEAD_TIME_OPTIONS = [5, 10, 15, 20, 30, 60];

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
const TEXT_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const ACCENT_OPTIONS = [
  { value: "amber", label: "Amber", swatch: "#D98E2B" },
  { value: "teal", label: "Teal", swatch: "#3E8C82" },
  { value: "blue", label: "Blue", swatch: "#4C6FA5" },
];
const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex" style={{ background: TOKENS.neutralBg, borderRadius: "10px", padding: "3px", gap: "3px" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, border: "none", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", cursor: "pointer",
            background: value === opt.value ? TOKENS.card : "transparent",
            color: value === opt.value ? TOKENS.ink : TOKENS.sub,
            fontWeight: value === opt.value ? 500 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleButton({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: on ? TOKENS.now : TOKENS.neutralBg,
        color: on ? "#fff" : TOKENS.sub,
        border: "none", borderRadius: "999px", padding: "6px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
      }}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "12px", color: TOKENS.sub, marginBottom: "8px" }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, children, last = false }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: last ? 0 : "14px" }}>
      <span style={{ fontSize: "13px", color: TOKENS.ink }}>{label}</span>
      {children}
    </div>
  );
}

// Full-takeover flow shown once after sign-up (stage starts at "welcome"),
// or reopened later in edit mode (isEdit=true skips straight to the
// questions, pre-filled) as the single "Settings" screen — display
// settings, reminders, and the personalization questions all in one
// place. onComplete receives the raw question answers; Dashboard handles
// parsing the sleep answer and persisting everything.
export default function Onboarding({
  name, isEdit = false, initialProfile = null, onComplete, onCancel,
  remindersEnabled, reminderLeadMinutes, onUpdateReminderSettings,
  settings, onUpdateSettings, onRequestDeleteAccount,
  plan = "free", billingLoading, onStartCheckout, onOpenBillingPortal,
  error, onDismissError,
}) {
  const [stage, setStage] = useState(isEdit ? "questions" : "welcome");
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({
    sleepAnswer: synthesizeSleepText(initialProfile),
    adhdType: initialProfile?.adhdType ?? null,
    focusTimes: initialProfile?.focusTimes || "",
    startDifficulty: initialProfile?.startDifficulty || "",
  });

  useEffect(() => {
    if (stage !== "welcome") return;
    const t1 = setTimeout(() => setWelcomeVisible(false), 1300);
    const t2 = setTimeout(() => setStage("intro"), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage]);

  const skipWelcome = () => {
    setWelcomeVisible(false);
    setStage("intro");
  };

  const goNext = () => {
    if (stepIndex + 1 < QUESTIONS.length) {
      setStepIndex((i) => i + 1);
    } else {
      onComplete(answers);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const skipQuestion = () => {
    const key = QUESTIONS[stepIndex].key;
    setAnswers((prev) => ({ ...prev, [key]: QUESTIONS[stepIndex].type === "scale" ? null : "" }));
    goNext();
  };

  // Every stage here is a full page in its own right (Dashboard renders
  // it instead of its own content, the same way it already does for
  // first-time onboarding) rather than an overlay stacked on top of
  // something else, so this is just a normal top-aligned page like the
  // rest of the app — no position:fixed, no risk of a short screen
  // leaving a huge dead area below it.
  const wrapCentered = {
    minHeight: "100vh", background: TOKENS.bg,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "24px",
  };
  const wrapTop = {
    minHeight: "100vh", background: TOKENS.bg,
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "24px", paddingTop: "64px", gap: "14px", paddingBottom: "64px",
  };

  if (stage === "welcome") {
    return (
      <div style={wrapCentered} onClick={skipWelcome}>
        <div style={{ textAlign: "center", opacity: welcomeVisible ? 1 : 0, transition: "opacity 500ms ease" }}>
          <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "32px", margin: 0 }}>
            Welcome{name ? `, ${name}` : ""}.
          </h1>
        </div>
      </div>
    );
  }

  if (stage === "intro") {
    return (
      <div style={wrapTop}>
        <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "28px", width: "400px", maxWidth: "100%", boxSizing: "border-box", textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "22px", margin: "0 0 12px" }}>
            A few quick questions
          </h2>
          <p style={{ fontSize: "14px", color: TOKENS.sub, lineHeight: 1.6, margin: "0 0 20px" }}>
            aidhd can learn your habits on its own over time, just from how you use it. But answering
            a few things now helps it personalize faster. Every question is optional, skip anything
            you&apos;d rather not answer.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onComplete({})}
              style={{ flex: 1, background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" }}
            >
              Skip for now
            </button>
            <button
              onClick={() => setStage("questions")}
              style={{ flex: 1, background: TOKENS.now, border: "none", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            >
              Let&apos;s go
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[stepIndex];
  const isLast = stepIndex === QUESTIONS.length - 1;
  const cardStyle = { background: TOKENS.card, borderRadius: "14px", padding: "20px 28px", width: "420px", maxWidth: "100%", boxSizing: "border-box" };

  return (
    <div style={wrapTop}>
      {isEdit && (
        <div style={{ width: "420px", maxWidth: "100%" }}>
          <button
            onClick={onCancel}
            className="flex items-center gap-1"
            style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "13px", cursor: "pointer", padding: 0, marginBottom: "16px" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "26px", margin: "0 0 4px" }}>
            Settings
          </h1>
          <p style={{ color: TOKENS.sub, fontSize: "13px", margin: 0 }}>
            Display, reminders, and a bit about you.
          </p>
        </div>
      )}

      {isEdit && error && (
        <div
          className="flex items-center justify-between"
          style={{ background: TOKENS.overflowBg, color: TOKENS.overflow, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", width: "420px", maxWidth: "100%", boxSizing: "border-box" }}
        >
          <span>{error}</span>
          <button onClick={onDismissError} style={{ background: "none", border: "none", color: TOKENS.overflow, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {isEdit && (
        <div style={cardStyle}>
          <div style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 14px" }}>Display</div>

          <Field label="Theme">
            <SegmentedControl options={THEME_OPTIONS} value={settings.theme} onChange={(v) => onUpdateSettings({ theme: v })} />
          </Field>
          <Field label="Text size">
            <SegmentedControl options={TEXT_SIZE_OPTIONS} value={settings.textSize} onChange={(v) => onUpdateSettings({ textSize: v })} />
          </Field>
          <Field label="Accent color">
            <div className="flex items-center gap-3">
              {ACCENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdateSettings({ accentColor: opt.value })}
                  title={opt.label}
                  aria-label={opt.label}
                  style={{
                    width: "32px", height: "32px", borderRadius: "999px", background: opt.swatch,
                    border: "none", cursor: "pointer",
                    outline: settings.accentColor === opt.value ? `2px solid ${TOKENS.ink}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="Task list density">
            <SegmentedControl options={DENSITY_OPTIONS} value={settings.taskDensity} onChange={(v) => onUpdateSettings({ taskDensity: v })} />
          </Field>

          <Row label="Reduce motion">
            <ToggleButton on={settings.reduceMotion} onToggle={() => onUpdateSettings({ reduceMotion: !settings.reduceMotion })} />
          </Row>
          <Row label="Completion sound" last>
            <ToggleButton on={settings.completionSoundEnabled} onToggle={() => onUpdateSettings({ completionSoundEnabled: !settings.completionSoundEnabled })} />
          </Row>
        </div>
      )}

      {isEdit && (
        <div style={cardStyle}>
          <div style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 12px" }}>Reminders</div>
          <Row label="Notify me before timed things start" last={!(remindersEnabled ?? true)}>
            <ToggleButton on={remindersEnabled ?? true} onToggle={() => onUpdateReminderSettings({ reminders_enabled: !(remindersEnabled ?? true) })} />
          </Row>
          {(remindersEnabled ?? true) && (
            <Row label="How much lead time" last>
              <select
                value={reminderLeadMinutes ?? 10}
                onChange={(e) => onUpdateReminderSettings({ reminder_lead_minutes: Number(e.target.value) })}
                style={{ background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "6px 10px", fontSize: "13px", fontFamily: "inherit" }}
              >
                {LEAD_TIME_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </Row>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: "12px", color: TOKENS.sub }}>
            {isEdit ? "About you · " : ""}Question {stepIndex + 1} of {QUESTIONS.length}
          </span>
        </div>

        <p style={{ fontSize: "16px", color: TOKENS.ink, lineHeight: 1.5, margin: "0 0 6px", fontWeight: 500 }}>
          {q.prompt}
        </p>
        {q.hint && (
          <p style={{ fontSize: "13px", color: TOKENS.sub, margin: "0 0 14px" }}>{q.hint}</p>
        )}

        {(q.type === "text" || q.type === "sleep") && (
          <textarea
            value={answers[q.key] || ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
            placeholder={q.placeholder}
            className="w-full"
            style={{
              background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: "10px",
              padding: "12px 14px", fontSize: "16px", fontFamily: "inherit", minHeight: "90px",
              outline: "none", resize: "vertical", boxSizing: "border-box", marginTop: "10px",
            }}
          />
        )}

        {q.type === "scale" && (
          <div style={{ marginTop: "18px" }}>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={answers.adhdType ?? 5}
              onChange={(e) => setAnswers((prev) => ({ ...prev, adhdType: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: TOKENS.now }}
            />
            <div className="flex items-center justify-between" style={{ fontSize: "12px", color: TOKENS.sub, marginTop: "4px" }}>
              <span>Very inattentive</span>
              <span>Combined</span>
              <span>Very hyperactive</span>
            </div>
            <p style={{ textAlign: "center", fontSize: "14px", color: TOKENS.ink, marginTop: "10px" }}>
              {answers.adhdType ?? 5} / 10
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-6">
          {stepIndex > 0 && (
            <button
              onClick={goBack}
              style={{ background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px 14px", fontSize: "14px", cursor: "pointer" }}
            >
              Back
            </button>
          )}
          <button
            onClick={skipQuestion}
            style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "13px", cursor: "pointer", padding: "10px" }}
          >
            Skip
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={goNext}
            style={{ background: TOKENS.now, border: "none", color: "#fff", borderRadius: "10px", padding: "10px 18px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            {isLast ? (isEdit ? "Save" : "Finish") : "Next"}
          </button>
        </div>
      </div>

      {isEdit && (
        <div style={cardStyle}>
          <Row label="Plan" last>
            <span
              style={{
                fontSize: "12px", fontWeight: 500, borderRadius: "999px", padding: "4px 10px",
                background: plan === "pro" ? TOKENS.calmBg : TOKENS.neutralBg,
                color: plan === "pro" ? TOKENS.calmText : TOKENS.neutralText,
              }}
            >
              {plan === "pro" ? "Pro" : "Free"}
            </span>
          </Row>
          <p style={{ fontSize: "13px", color: TOKENS.sub, margin: "14px 0" }}>
            Everything works the same regardless of plan for now.
          </p>
          <button
            onClick={plan === "pro" ? onOpenBillingPortal : onStartCheckout}
            disabled={billingLoading}
            style={{
              background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px",
              padding: "9px 14px", fontSize: "13px", cursor: billingLoading ? "default" : "pointer", opacity: billingLoading ? 0.7 : 1,
            }}
          >
            {billingLoading ? "One sec…" : plan === "pro" ? "Manage subscription" : "Upgrade"}
          </button>
        </div>
      )}

      {isEdit && (
        <div style={cardStyle}>
          <div style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 6px" }}>Account</div>
          <p style={{ fontSize: "13px", color: TOKENS.sub, margin: "0 0 14px" }}>
            Permanently delete your account and everything in it.
          </p>
          <button
            onClick={onRequestDeleteAccount}
            style={{ background: "none", border: `1px solid ${TOKENS.overflow}`, color: TOKENS.overflow, borderRadius: "10px", padding: "9px 14px", fontSize: "13px", cursor: "pointer" }}
          >
            Delete my account
          </button>
        </div>
      )}
    </div>
  );
}
