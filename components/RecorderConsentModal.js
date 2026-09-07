"use client";

import { TOKENS } from "@/lib/theme";

// Shown once, before someone's first recording ever starts (before the
// browser's own mic permission prompt even appears). Consent-to-record
// laws vary a lot by where you live, so this is deliberately short and
// points to the fuller detail rather than trying to restate it here.
export default function RecorderConsentModal({ onAcknowledge, onCancel }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 60,
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "380px", maxWidth: "100%", boxSizing: "border-box" }}>
        <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: "0 0 10px" }}>
          Before you record
        </h3>
        <p style={{ fontSize: "14px", color: TOKENS.ink, lineHeight: 1.6, margin: "0 0 10px" }}>
          If you&apos;re recording a class, meeting, or anyone else, some places require
          their consent first. It&apos;s on you to check what applies where you are.
        </p>
        <p style={{ fontSize: "13px", color: TOKENS.sub, margin: "0 0 20px" }}>
          Full detail is in the{" "}
          <a href="/terms#recording" target="_blank" rel="noopener noreferrer" style={{ color: TOKENS.sub }}>
            terms of service
          </a>
          .
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onAcknowledge}
            style={{ background: TOKENS.now, border: "none", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
          >
            I understand, start recording
          </button>
          <button
            onClick={onCancel}
            style={{ background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
