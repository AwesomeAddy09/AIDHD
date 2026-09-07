"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";
import TimeField, { to24h } from "@/components/TimeField";

// One item at a time from a queue built in Dashboard.js. onSave receives
// {start, end} in minutes-since-midnight; onSkip means "don't add this to
// the calendar" — it still gets kept as a flexible, untimed task rather
// than disappearing.
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
          &quot;{item.text}&quot; sounds like it has a set time. When is it?
        </p>

        <TimeField label="Start time" {...start} onChange={setStart} />

        <TimeField
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
