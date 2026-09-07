"use client";

import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];
const TEXT_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const ACCENT_OPTIONS = [
  { value: "amber", label: "Amber", swatch: "#D98E2B" },
  { value: "teal", label: "Teal", swatch: "#3E8C82" },
  { value: "blue", label: "Blue", swatch: "#4C6FA5" },
];
const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex" style={{ background: TOKENS.neutralBg, borderRadius: "10px", padding: "3px", gap: "3px" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, border: "none", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", cursor: "pointer",
            background: value === opt.value ? TOKENS.card : "transparent",
            color: value === opt.value ? TOKENS.ink : TOKENS.sub,
            fontWeight: value === opt.value ? 500 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleButton({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: on ? TOKENS.now : TOKENS.neutralBg,
        color: on ? "#fff" : TOKENS.sub,
        border: "none", borderRadius: "999px", padding: "6px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer",
      }}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "12px", color: TOKENS.sub, marginBottom: "8px" }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: "14px" }}>
      <span style={{ fontSize: "13px", color: TOKENS.ink }}>{label}</span>
      {children}
    </div>
  );
}

// Display/accessibility settings — separate from the task-specific
// Preferences (sleep schedule, ADHD type, reminders). Every field has a
// sensible default (see lib/settings.js's DEFAULT_SETTINGS) so nobody
// has to open this to have a good experience.
export default function Settings({ settings, onUpdate, onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: TOKENS.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "24px", paddingTop: "64px", zIndex: 60, overflowY: "auto",
      }}
    >
      <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "28px", width: "420px", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "20px", margin: 0 }}>
            Settings
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TOKENS.sub, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <Field label="Theme">
          <SegmentedControl options={THEME_OPTIONS} value={settings.theme} onChange={(v) => onUpdate({ theme: v })} />
        </Field>

        <Field label="Text size">
          <SegmentedControl options={TEXT_SIZE_OPTIONS} value={settings.textSize} onChange={(v) => onUpdate({ textSize: v })} />
        </Field>

        <Field label="Accent color">
          <div className="flex items-center gap-3">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onUpdate({ accentColor: opt.value })}
                title={opt.label}
                aria-label={opt.label}
                style={{
                  width: "32px", height: "32px", borderRadius: "999px", background: opt.swatch,
                  border: "none", cursor: "pointer",
                  outline: settings.accentColor === opt.value ? `2px solid ${TOKENS.ink}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </Field>

        <Field label="Task list density">
          <SegmentedControl options={DENSITY_OPTIONS} value={settings.taskDensity} onChange={(v) => onUpdate({ taskDensity: v })} />
        </Field>

        <Row label="Reduce motion">
          <ToggleButton on={settings.reduceMotion} onToggle={() => onUpdate({ reduceMotion: !settings.reduceMotion })} />
        </Row>
        <Row label="Completion sound">
          <ToggleButton on={settings.completionSoundEnabled} onToggle={() => onUpdate({ completionSoundEnabled: !settings.completionSoundEnabled })} />
        </Row>
      </div>
    </div>
  );
}
