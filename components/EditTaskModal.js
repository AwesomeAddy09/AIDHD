"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";
import { CATEGORY_LABEL } from "@/lib/scheduling";

const CATEGORIES = Object.keys(CATEGORY_LABEL);

export default function EditTaskModal({ task, onSave, onCancel }) {
  const [text, setText] = useState(task.text);
  const [category, setCategory] = useState(task.category);
  const [minutes, setMinutes] = useState(task.minutes);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || "");

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      text: text.trim(),
      category,
      minutes: Math.max(1, Number(minutes) || 20),
      priority: Number(priority),
      due_date: dueDate || null,
    });
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div className="flex items-start justify-between mb-4">
          <h3 style={titleStyle}>Edit task</h3>
          <button onClick={onCancel} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <label style={labelStyle}>What</label>
        <input value={text} onChange={(e) => setText(e.target.value)} style={inputStyle} />

        <div className="flex gap-3 mt-3">
          <div className="flex-1">
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div style={{ width: "90px" }}>
            <label style={labelStyle}>Minutes</label>
            <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="flex gap-3 mt-3">
          <div className="flex-1">
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              <option value={1}>Urgent</option>
              <option value={2}>Normal</option>
              <option value={3}>Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label style={labelStyle}>Due date (optional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
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
