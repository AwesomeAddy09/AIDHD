"use client";

import { TOKENS } from "@/lib/theme";

export const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
export const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function to24h(hour12, minute, ampm) {
  let h = hour12 % 12;
  if (ampm === "PM") h += 12;
  return h * 60 + minute;
}

// Inverse of to24h — given minutes-since-midnight, returns {hour, minute,
// ampm} for pre-filling a picker from an existing value.
export function from24h(totalMinutes) {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour, minute, ampm };
}

// A 12-hour time picker with an explicit AM/PM toggle (never relies on
// the browser/OS locale, unlike a native <input type="time">).
export default function TimeField({ label, hour, minute, ampm, onChange, extra }) {
  return (
    <div className="mb-4">
      {label && (
        <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", marginBottom: "6px" }}>
          {label}
        </label>
      )}
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

const selectStyle = {
  background: TOKENS.card,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: "8px",
  padding: "9px 8px",
  fontSize: "16px",
  fontFamily: "inherit",
  outline: "none",
};
