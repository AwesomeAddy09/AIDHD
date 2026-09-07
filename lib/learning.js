// Time-blindness pattern learning: quietly adjusts future estimates for a
// category once there's enough real history to trust, instead of trusting
// the AI's first guess forever. See CLAUDE.md's shame-free principle —
// this is informational, never a call-out.

// Below this many completed-with-timing tasks in a category, we don't
// have enough signal to trust an adjustment yet.
export const MIN_SAMPLES = 3;

// Don't bother adjusting (or showing a note) for a trivial difference —
// only when it's a real enough gap to be worth acting on.
const MEANINGFUL_DIFF_RATIO = 0.2;

// {category: {ratio, samples}} — ratio is the average of actual/estimated
// across that category's completed, timed tasks.
export function computeCategoryMultipliers(tasks) {
  const byCategory = {};
  for (const t of tasks) {
    if (t.actualMinutes == null || !t.minutes) continue;
    const ratio = t.actualMinutes / t.minutes;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    (byCategory[t.category] ??= []).push(ratio);
  }

  const result = {};
  for (const [category, ratios] of Object.entries(byCategory)) {
    if (ratios.length < MIN_SAMPLES) continue;
    const avg = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    result[category] = { ratio: avg, samples: ratios.length };
  }
  return result;
}

// Applies a learned multiplier to undone, not-yet-timed tasks. Leaves
// completed or already-timed tasks untouched. Returns the same task
// objects when no meaningful adjustment applies, or a copy carrying both
// the adjusted `minutes` (used for display and scheduling) and the
// original `rawMinutes` (so the UI can show a quiet "usually closer to…"
// note) when it does.
export function applyLearnedEstimates(tasks, multipliers) {
  return tasks.map((t) => {
    if (t.done || t.actualMinutes != null) return t;
    const learned = multipliers[t.category];
    if (!learned) return t;

    const adjusted = Math.max(1, Math.round(t.minutes * learned.ratio));
    if (Math.abs(adjusted - t.minutes) / t.minutes < MEANINGFUL_DIFF_RATIO) return t;

    return { ...t, minutes: adjusted, rawMinutes: t.minutes };
  });
}
