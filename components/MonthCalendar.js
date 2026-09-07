"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { TOKENS } from "@/lib/theme";
import { dateKey, isToday } from "@/lib/scheduling";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function buildMonthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

// A lightweight month grid (like iOS Calendar's month view) — a dot per
// day for fixed-time events and one for due-date tasks. Tapping a day
// hands it to the caller, which switches back to the single-day view for
// that date — that's the "zoom into a day" interaction.
export default function MonthCalendar({ monthDate, onChangeMonth, eventsByDate, tasks, onSelectDay }) {
  const days = buildMonthGrid(monthDate);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const currentMonth = monthDate.getMonth();
  const dueDates = new Set(tasks.filter((t) => t.dueDate).map((t) => t.dueDate));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onChangeMonth(-1)} style={navBtnStyle}><ChevronLeft size={18} /></button>
        <span style={{ fontSize: "14px", fontWeight: 500 }}>{monthLabel}</span>
        <button onClick={() => onChangeMonth(1)} style={navBtnStyle}><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7" style={{ marginBottom: "4px" }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "11px", color: TOKENS.sub }}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === currentMonth;
          const hasEvents = (eventsByDate[key] || []).length > 0;
          const hasDueTasks = dueDates.has(key);
          const today = isToday(d);
          return (
            <button
              key={key}
              onClick={() => onSelectDay(d)}
              className="flex flex-col items-center"
              style={{
                background: "none",
                border: "none",
                borderRadius: "8px",
                padding: "6px 0",
                cursor: "pointer",
                opacity: inMonth ? 1 : 0.35,
                gap: "3px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "999px",
                  background: today ? TOKENS.now : "transparent",
                  color: today ? "#fff" : TOKENS.ink,
                  fontWeight: today ? 600 : 400,
                }}
              >
                {d.getDate()}
              </span>
              <span style={{ display: "flex", gap: "3px", height: "5px" }}>
                {hasEvents && <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: TOKENS.now }} />}
                {hasDueTasks && <span style={{ width: "5px", height: "5px", borderRadius: "999px", background: TOKENS.calm }} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3" style={{ fontSize: "12px", color: TOKENS.sub }}>
        <span className="flex items-center gap-1">
          <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: TOKENS.now, display: "inline-block" }} />
          Fixed-time
        </span>
        <span className="flex items-center gap-1">
          <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: TOKENS.calm, display: "inline-block" }} />
          Due that day
        </span>
      </div>
    </div>
  );
}

const navBtnStyle = { background: "none", border: "none", cursor: "pointer", color: TOKENS.sub, display: "flex" };
