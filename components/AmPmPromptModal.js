"use client";

import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";

// A quick, minimal clarification — only shown when Claude genuinely
// couldn't tell AM from PM (e.g. "call mom at 3"). Not a full time-entry
// form: the hour/minute are already known, only the meridiem is unclear.
export default function AmPmPromptModal({ item, onChoose, onSkip }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 50,
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "320px", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="flex items-start justify-between mb-1">
          <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: 0 }}>
            AM or PM?
          </h3>
          <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: "14px", color: TOKENS.sub, margin: "0 0 18px" }}>
          &quot;{item.text}&quot; at {item.hour}:{item.minute.toString().padStart(2, "0")} — morning or afternoon/evening?
        </p>

        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => onChoose("AM")}
            style={{ flex: 1, background: TOKENS.card, border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}
          >
            AM
          </button>
          <button
            onClick={() => onChoose("PM")}
            style={{ flex: 1, background: TOKENS.card, border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}
          >
            PM
          </button>
        </div>
        <button
          onClick={onSkip}
          style={{ width: "100%", background: "none", border: "none", color: TOKENS.sub, fontSize: "13px", cursor: "pointer", padding: "6px" }}
        >
          Don&apos;t add it
        </button>
      </div>
    </div>
  );
}
