"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function to24h(hour12, minute, ampm) {
  let h = hour12 % 12;
  if (ampm === "PM") h += 12;
  return h * 60 + minute;
}

function TimeRow({ label, hour, minute, ampm, onChange, extra }) {
  return (
    <div className="mb-4">
      <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", marginBottom: "6px" }}>
        {label}
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={hour}
          onChange={(e) => onChange({ hour: Number(e.target.value), minute, ampm })}
          style={selectStyle}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span style={{ color: TOKENS.sub }}>:</span>
        <select
          value={minute}
          onChange={(e) => onChange({ hour, minute: Number(e.target.value), ampm })}
          style={selectStyle}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
          ))}
        </select>
        <div className="flex items-center" style={{ border: `1px solid ${TOKENS.border}`, borderRadius: "8px", overflow: "hidden" }}>
          {["AM", "PM"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ hour, minute, ampm: p })}
              style={{
                border: "none",
                padding: "9px 12px",
                fontSize: "16px",
                cursor: "pointer",
                background: ampm === p ? TOKENS.now : TOKENS.card,
                color: ampm === p ? "#fff" : TOKENS.ink,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        {extra}
      </div>
    </div>
  );
}

// One item at a time from a queue built in Dashboard.js. onSave receives
// {start, end} in minutes-since-midnight; onSkip means "don't add this to
// the calendar at all" (per the user's spec — X cancels, it isn't added).
export default function TimePromptModal({ item, onSave, onSkip }) {
  const [start, setStart] = useState({ hour: 9, minute: 0, ampm: "AM" });
  const [end, setEnd] = useState({ hour: 9, minute: 0, ampm: "AM" });
  const [endUnknown, setEndUnknown] = useState(false);

  const handleSave = () => {
    const startMin = to24h(start.hour, start.minute, start.ampm);
    let endMin;
    if (endUnknown) {
      endMin = startMin + 60;
    } else {
      endMin = to24h(end.hour, end.minute, end.ampm);
      if (endMin <= startMin) endMin = startMin + 30;
    }
    onSave({ start: startMin, end: endMin });
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 50,
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "360px", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="flex items-start justify-between mb-1">
          <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: 0 }}>
            What time?
          </h3>
          <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: "14px", color: TOKENS.sub, margin: "0 0 18px" }}>
          &quot;{item.text}&quot; sounds like it has a set time — when is it?
        </p>

        <TimeRow label="Start time" {...start} onChange={setStart} />

        <TimeRow
          label="End time"
          {...end}
          onChange={(v) => { setEnd(v); setEndUnknown(false); }}
          extra={
            <button
              type="button"
              onClick={() => setEndUnknown(true)}
              style={{
                border: `1px solid ${TOKENS.border}`, borderRadius: "8px", padding: "9px 12px",
                fontSize: "13px", cursor: "pointer",
                background: endUnknown ? TOKENS.neutralBg : TOKENS.card,
                color: endUnknown ? TOKENS.neutralText : TOKENS.sub,
              }}
            >
              I don&apos;t know
            </button>
          }
        />

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onSkip}
            style={{ flex: 1, background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" }}
          >
            Don&apos;t add it
          </button>
          <button
            onClick={handleSave}
            style={{ flex: 1, background: TOKENS.now, border: "none", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            Add to calendar
          </button>
        </div>
      </div>
    </div>
  );
}

const selectStyle = {
  background: TOKENS.card,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: "8px",
  padding: "9px 8px",
  fontSize: "16px",
  fontFamily: "inherit",
  outline: "none",
};
