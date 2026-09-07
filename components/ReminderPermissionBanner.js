"use client";

import { Bell, X } from "lucide-react";
import { TOKENS } from "@/lib/theme";

// Shown once, the first time someone adds something with a real time
// attached to it — not on sign-in, where it'd have no context. Browsers
// show their own generic permission dialog with no room for explanation,
// so this gives the reason first and only triggers that dialog if they
// opt in here.
export default function ReminderPermissionBanner({ onAllow, onDismiss }) {
  return (
    <div
      className="mb-6 flex items-center justify-between gap-3"
      style={{ background: TOKENS.neutralBg, color: TOKENS.ink, borderRadius: "10px", padding: "12px 14px", fontSize: "14px" }}
    >
      <div className="flex items-center gap-2">
        <Bell size={16} style={{ flexShrink: 0, color: TOKENS.sub }} />
        <span>Get a nudge before things start?</span>
      </div>
      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        <button
          onClick={onAllow}
          style={{ background: TOKENS.now, border: "none", color: "#fff", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
        >
          Turn on
        </button>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: TOKENS.sub, cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
