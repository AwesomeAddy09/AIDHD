"use client";

import { useEffect, useState } from "react";
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

// Full-takeover flow shown once after sign-up (stage starts at "welcome"),
// or reopened later in edit mode (isEdit=true skips straight to the
// questions, pre-filled). onComplete receives the raw answers; Dashboard
// handles parsing the sleep answer and persisting everything.
export default function Onboarding({ name, isEdit = false, initialProfile = null, onComplete, onCancel }) {
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

  const wrap = {
    position: "fixed", inset: 0, background: TOKENS.bg,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "24px", zIndex: 60,
  };

  if (stage === "welcome") {
    return (
      <div style={wrap} onClick={skipWelcome}>
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
      <div style={wrap}>
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

  return (
    <div style={wrap}>
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "28px", width: "420px", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: "12px", color: TOKENS.sub }}>
            {isEdit ? "Editing preferences" : `Question ${stepIndex + 1} of ${QUESTIONS.length}`}
          </span>
          {isEdit && (
            <button onClick={onCancel} style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer" }}>
              Close
            </button>
          )}
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
    </div>
  );
}
