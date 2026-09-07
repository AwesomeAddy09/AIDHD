// A small, synthesized "task complete" chime — two quick ascending
// notes on a soft sine wave, done entirely with the Web Audio API so
// there's no audio file to ship or license. Each note has a short
// attack/decay envelope so it sounds like a gentle pop rather than a
// harsh beep, and never overlaps with a still-fading previous note.

let sharedContext = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

function playNote(ctx, startTime, frequency, duration, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function playCompletionSound() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  playNote(ctx, now, 587.33, 0.14, 0.09); // D5
  playNote(ctx, now + 0.09, 880, 0.18, 0.09); // A5
}
