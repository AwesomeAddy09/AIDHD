"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TOKENS } from "@/lib/theme";
import { isToday, nowMinutes, minsToLabel } from "@/lib/scheduling";

const VIEW_START = 6 * 60; // 6:00 AM
const VIEW_END = 24 * 60; // midnight
const PX_PER_MIN = 1;
const FALLBACK_MINUTES = 15; // only used when a block has no real duration at all
const MAX_COLUMNS = 4; // beyond this, the extras collapse into a "+N more" tag

function hourLabel(totalMin) {
  const h = Math.floor(totalMin / 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

// Groups transitively-overlapping blocks and assigns each a lane within
// its group (the Google/iOS Calendar trick: overlapping items split
// into side-by-side columns instead of stacking on top of each other).
// Groups deeper than MAX_COLUMNS collapse the narrowest lanes into a
// single "+N more" tag so columns never become unreadably thin.
function layoutBlocks(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const groups = [];
  let current = [];
  let groupEnd = -Infinity;
  for (const b of sorted) {
    if (current.length === 0 || b.start < groupEnd) {
      current.push(b);
      groupEnd = Math.max(groupEnd, b.end);
    } else {
      groups.push(current);
      current = [b];
      groupEnd = b.end;
    }
  }
  if (current.length) groups.push(current);

  const result = [];
  for (const group of groups) {
    const laneEnds = [];
    const withLanes = [];
    for (const b of group) {
      let lane = laneEnds.findIndex((end) => end <= b.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(b.end);
      } else {
        laneEnds[lane] = b.end;
      }
      withLanes.push({ ...b, lane });
    }
    const totalLanes = laneEnds.length;

    if (totalLanes <= MAX_COLUMNS) {
      for (const b of withLanes) result.push({ ...b, laneCount: totalLanes });
      continue;
    }

    // Too many at once: show the first few real lanes, collapse the
    // rest of the columns into one "+N more" tag in the last slot.
    const realLaneCap = MAX_COLUMNS - 1;
    const visible = withLanes.filter((b) => b.lane < realLaneCap);
    const hidden = withLanes.filter((b) => b.lane >= realLaneCap);
    for (const b of visible) result.push({ ...b, laneCount: MAX_COLUMNS });
    if (hidden.length > 0) {
      result.push({
        id: `overflow-${group[0].id}`,
        kind: "overflow",
        text: `+${hidden.length} more`,
        start: Math.min(...hidden.map((b) => b.start)),
        end: Math.max(...hidden.map((b) => b.end)),
        lane: realLaneCap,
        laneCount: MAX_COLUMNS,
        items: hidden,
      });
    }
  }
  return result;
}

function blockColors(block) {
  if (block.kind === "overflow") return { bg: TOKENS.neutralBg, text: TOKENS.neutralText, border: TOKENS.sub };
  if (block.kind === "task") return { bg: TOKENS.calmBg, text: TOKENS.calmText, border: TOKENS.calm };
  if (block.isRecurring) return { bg: TOKENS.nowBg, text: TOKENS.nowText, border: TOKENS.now };
  return { bg: TOKENS.eventBg, text: TOKENS.eventText, border: TOKENS.event };
}

// tasks: the already-scheduled array from scheduleTasks() for this date
// (only undone, positioned ones are shown — done and overflow tasks have
// no time slot to draw). events: this date's fixed-time events.
export default function DayTimeline({ date, events, tasks, onSelectEvent, onSelectTask }) {
  const [overflowGroup, setOverflowGroup] = useState(null); // array of hidden blocks, or null

  const blocks = layoutBlocks([
    ...events.map((e) => ({
      id: e.id, kind: "event", text: e.text, start: e.start, end: e.end, isRecurring: e.isRecurring, ref: e,
    })),
    ...tasks
      .filter((t) => !t.done && !t.overflow && t.scheduledStart != null)
      .map((t) => ({
        id: t.id, kind: "task", text: t.text, start: t.scheduledStart, end: t.scheduledStart + t.minutes, ref: t,
      })),
  ]);

  const height = (VIEW_END - VIEW_START) * PX_PER_MIN;
  const hours = [];
  for (let m = VIEW_START; m < VIEW_END; m += 60) hours.push(m);

  const showNowLine = isToday(date) && nowMinutes() >= VIEW_START && nowMinutes() <= VIEW_END;

  const selectBlock = (b) => {
    if (b.kind === "overflow") {
      setOverflowGroup(b.items);
    } else if (b.kind === "event") {
      onSelectEvent(b.ref);
    } else {
      onSelectTask(b.ref);
    }
  };

  return (
    <div className="flex" style={{ position: "relative", height: `${height}px`, overflow: "hidden" }}>
      <div style={{ width: "48px", flexShrink: 0, position: "relative" }}>
        {hours.map((m) => (
          <div key={m} style={{ position: "absolute", top: `${(m - VIEW_START) * PX_PER_MIN - 6}px`, fontSize: "11px", color: TOKENS.sub }}>
            {hourLabel(m)}
          </div>
        ))}
      </div>

      <div style={{ position: "relative", flex: 1, borderLeft: `1px solid ${TOKENS.border}` }}>
        {hours.map((m) => (
          <div
            key={m}
            style={{ position: "absolute", top: `${(m - VIEW_START) * PX_PER_MIN}px`, left: 0, right: 0, borderTop: `1px solid ${TOKENS.border}` }}
          />
        ))}

        {showNowLine && (
          <div
            style={{
              position: "absolute", top: `${(nowMinutes() - VIEW_START) * PX_PER_MIN}px`, left: 0, right: 0,
              borderTop: `2px solid ${TOKENS.overflow}`, zIndex: 2,
            }}
          />
        )}

        {blocks.map((b) => {
          const top = Math.max(0, (b.start - VIEW_START) * PX_PER_MIN);
          const rawDuration = b.end - b.start;
          const durationMin = rawDuration > 0 ? rawDuration : FALLBACK_MINUTES;
          const heightPx = durationMin * PX_PER_MIN;
          const colors = blockColors(b);
          const gutter = 3;

          return (
            <button
              key={b.id}
              onClick={() => selectBlock(b)}
              style={{
                position: "absolute",
                top: `${top}px`,
                height: `${heightPx}px`,
                left: `calc(${(b.lane / b.laneCount) * 100}% + ${gutter}px)`,
                width: `calc(${100 / b.laneCount}% - ${gutter * 2}px)`,
                background: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
                borderRadius: "4px",
                opacity: 0.9,
                padding: "2px 5px",
                textAlign: "left",
                cursor: "pointer",
                overflow: "hidden",
                zIndex: 1,
              }}
              title={b.kind === "overflow" ? b.text : `${b.text} (${minsToLabel(b.start)} to ${minsToLabel(b.end)})`}
            >
              <span style={{ fontSize: "11px", fontWeight: b.kind === "overflow" ? 600 : 400, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                {b.text}
              </span>
            </button>
          );
        })}
      </div>

      {overflowGroup && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(32,36,30,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px", zIndex: 56,
          }}
        >
          <div style={{ background: TOKENS.card, borderRadius: "14px", padding: "20px", width: "320px", maxWidth: "100%", boxSizing: "border-box" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "16px", margin: 0 }}>
                {overflowGroup.length} more at this time
              </h3>
              <button onClick={() => setOverflowGroup(null)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.sub }}>
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {overflowGroup.map((b) => {
                const colors = blockColors(b);
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setOverflowGroup(null);
                      selectBlock(b);
                    }}
                    style={{
                      textAlign: "left", background: colors.bg, border: `1px solid ${TOKENS.border}`, borderLeft: `3px solid ${colors.border}`,
                      borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: colors.text, cursor: "pointer",
                    }}
                  >
                    {b.text} ({minsToLabel(b.start)} to {minsToLabel(b.end)})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
