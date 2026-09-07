"use client";

import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";

const QUESTION_BY_ACTION = {
  delete: "Which one do you want to remove?",
  complete: "Which one did you finish?",
  update: "Which one do you want to change?",
};

// Shown when the AI recognized an edit/delete/complete request but
// couldn't confidently tell which existing item it referred to — rather
// than guessing, it lists the plausible candidates for a person to pick.
export default function ClarifyModal({ item, onChoose, onSkip }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 50,
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "380px", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="flex items-start justify-between mb-1">
          <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: 0 }}>
            Not sure which one
          </h3>
          <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: "14px", color: TOKENS.sub, margin: "0 0 16px" }}>
          {QUESTION_BY_ACTION[item.action] || "Which one did you mean?"}
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {item.candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => onChoose(c.id)}
              style={{
                textAlign: "left", background: TOKENS.bg, border: `1px solid ${TOKENS.border}`,
                borderRadius: "10px", padding: "12px 14px", fontSize: "14px", color: TOKENS.ink, cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          onClick={onSkip}
          style={{ width: "100%", background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" }}
        >
          None of these
        </button>
      </div>
    </div>
  );
}
