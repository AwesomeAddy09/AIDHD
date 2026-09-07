"use client";

import { TOKENS } from "@/lib/theme";
import { minsToLabel } from "@/lib/scheduling";

// Shown before adding or moving an event when it overlaps something
// already on that day. Never blocks the add outright, just makes sure
// it's a choice rather than a silent double-booking.
export default function ConflictModal({ conflicts, onAddAnyway, onDontAdd, onGoToCalendar }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 55,
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "380px", maxWidth: "100%", boxSizing: "border-box" }}>
        <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: "0 0 8px" }}>
          That overlaps with something
        </h3>
        <div style={{ fontSize: "14px", color: TOKENS.sub, lineHeight: 1.6, marginBottom: "18px" }}>
          {conflicts.map((c) => (
            <div key={c.id}>{c.text} ({minsToLabel(c.start)} to {minsToLabel(c.end)})</div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onAddAnyway}
            style={{ background: TOKENS.now, border: "none", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            Add it anyway
          </button>
          <button
            onClick={onDontAdd}
            style={{ background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" }}
          >
            Don&apos;t add it
          </button>
          <button
            onClick={onGoToCalendar}
            style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "13px", cursor: "pointer", padding: "6px" }}
          >
            Go to calendar instead
          </button>
        </div>
      </div>
    </div>
  );
}
