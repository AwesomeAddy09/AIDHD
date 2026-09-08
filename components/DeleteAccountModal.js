"use client";

import { TOKENS } from "@/lib/theme";

export default function DeleteAccountModal({ onConfirm, onCancel, deleting, error }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px", zIndex: 70,
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "380px", maxWidth: "100%", boxSizing: "border-box" }}>
        <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: "0 0 8px" }}>
          Delete your account?
        </h3>
        <p style={{ fontSize: "14px", color: TOKENS.ink, lineHeight: 1.6, margin: "0 0 20px" }}>
          This permanently deletes your account and everything in it: tasks, calendar events, Lesson
          Recorder summaries, and preferences. There&apos;s no undo.
        </p>

        {error && (
          <p style={{ fontSize: "13px", color: TOKENS.overflow, margin: "0 0 14px" }}>{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              background: TOKENS.overflow, border: "none", color: "#fff", borderRadius: "10px",
              padding: "10px", fontSize: "14px", fontWeight: 500,
              cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Yes, delete everything"}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{ background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
