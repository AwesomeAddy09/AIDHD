"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";
import TimeField, { to24h, from24h } from "@/components/TimeField";

export default function EditEventModal({ event, date, onSave, onCancel }) {
  const [text, setText] = useState(event.text);
  const [eventDate, setEventDate] = useState(date);
  const [start, setStart] = useState(from24h(event.start));
  const [end, setEnd] = useState(from24h(event.end));

  const handleSave = () => {
    if (!text.trim()) return;
    const startMin = to24h(start.hour, start.minute, start.ampm);
    let endMin = to24h(end.hour, end.minute, end.ampm);
    if (endMin <= startMin) endMin = startMin + 30;
    onSave({ text: text.trim(), date: eventDate, start: startMin, end: endMin });
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div className="flex items-start justify-between mb-4">
          <h3 style={titleStyle}>Edit event</h3>
          <button onClick={onCancel} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <label style={labelStyle}>What</label>
        <input value={text} onChange={(e) => setText(e.target.value)} style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: "14px" }}>Date</label>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />

        <div style={{ marginTop: "14px" }}>
          <TimeField label="Start time" {...start} onChange={setStart} />
          <TimeField label="End time" {...end} onChange={setEnd} />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={handleSave} style={primaryBtnStyle}>Save</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "16px", zIndex: 50,
};
const cardStyle = { background: TOKENS.card, borderRadius: "14px", padding: "24px", width: "380px", maxWidth: "100%", boxSizing: "border-box" };
const titleStyle = { fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "18px", margin: 0 };
const closeBtnStyle = { background: "none", border: "none", cursor: "pointer", color: TOKENS.sub };
const labelStyle = { fontSize: "13px", color: TOKENS.sub, display: "block", marginBottom: "6px" };
const inputStyle = {
  width: "100%", background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: "8px",
  padding: "9px 10px", fontSize: "16px", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const primaryBtnStyle = { flex: 1, background: TOKENS.now, border: "none", color: "#fff", borderRadius: "10px", padding: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer" };
const secondaryBtnStyle = { flex: 1, background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.ink, borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" };
