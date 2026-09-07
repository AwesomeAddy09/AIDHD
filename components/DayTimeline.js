"use client";

import { TOKENS } from "@/lib/theme";
import { isToday, nowMinutes } from "@/lib/scheduling";

const VIEW_START = 6 * 60; // 6:00 AM
const VIEW_END = 24 * 60; // midnight
const PX_PER_MIN = 1;
const MIN_BLOCK_MINUTES = 15; // visual floor so short items stay visible/tappable

function hourLabel(totalMin) {
  const h = Math.floor(totalMin / 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

// Groups transitively-overlapping blocks and assigns each a lane within
// its group, the same technique Google/iOS Calendar use: overlapping
// items split into equal-width side-by-side columns instead of stacking
// on top of each other.
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

  const positioned = [];
  for (const group of groups) {
    const laneEnds = [];
    for (const b of group) {
      let lane = laneEnds.findIndex((end) => end <= b.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(b.end);
      } else {
        laneEnds[lane] = b.end;
      }
      positioned.push({ ...b, lane, laneCount: 0 });
    }
    for (const p of positioned.slice(-group.length)) p.laneCount = laneEnds.length;
  }
  return positioned;
}

function blockColors(block) {
  if (block.kind === "task") return { bg: TOKENS.calmBg, text: TOKENS.calmText, border: TOKENS.calm };
  if (block.isRecurring) return { bg: TOKENS.nowBg, text: TOKENS.nowText, border: TOKENS.now };
  return { bg: TOKENS.eventBg, text: TOKENS.eventText, border: TOKENS.event };
}

// tasks: the already-scheduled array from scheduleTasks() for this date
// (only undone, positioned ones are shown — done and overflow tasks have
// no time slot to draw). events: this date's fixed-time events.
export default function DayTimeline({ date, events, tasks, onSelectEvent, onSelectTask }) {
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
          const durationMin = Math.max(b.end - b.start, MIN_BLOCK_MINUTES);
          const heightPx = durationMin * PX_PER_MIN;
          const colors = blockColors(b);
          const showText = b.laneCount <= 2 && heightPx >= 28;
          const gutter = 3;

          return (
            <button
              key={b.id}
              onClick={() => (b.kind === "event" ? onSelectEvent(b.ref) : onSelectTask(b.ref))}
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
                padding: showText ? "3px 6px" : 0,
                textAlign: "left",
                cursor: "pointer",
                overflow: "hidden",
                zIndex: 1,
              }}
              title={b.text}
            >
              {showText && (
                <span style={{ fontSize: "11px", color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                  {b.text}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
