// Display/accessibility settings: theme, accent color, text size,
// reduce motion, completion sound, task list density. Distinct from the
// task-specific "Preferences" (sleep schedule, ADHD type, reminders) —
// see components/Settings.js. Canonically stored in the profiles table
// (see lib/data.js), cached in localStorage for instant first-paint so
// there's no flash of the wrong theme while the real profile loads (see
// the blocking inline script in app/layout.js).

export const DEFAULT_SETTINGS = {
  theme: "system", // "light" | "dark" | "system"
  accentColor: "amber", // "amber" | "teal" | "blue"
  textSize: "medium", // "small" | "medium" | "large"
  reduceMotion: false,
  completionSoundEnabled: true,
  taskDensity: "comfortable", // "compact" | "comfortable"
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const STORAGE_KEY = "aidhd:settings";

// Pulls just the settings-relevant fields out of a full profile object
// (as returned by lib/data.js's fetchProfile), filling in defaults for
// anyone who hasn't customized anything yet.
export function pickSettings(profile) {
  const out = { ...DEFAULT_SETTINGS };
  if (!profile) return out;
  for (const key of SETTINGS_KEYS) {
    if (profile[key] !== undefined && profile[key] !== null) out[key] = profile[key];
  }
  return out;
}

export function loadCachedSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function cacheSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // Private mode etc. — settings still work, just re-fetched each load.
  }
}

// Resolves "system" against the OS/browser preference at call time, so
// the attribute this sets is always concretely "light" or "dark".
function resolveTheme(theme) {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applySettingsToDocument(settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme ?? DEFAULT_SETTINGS.theme);
  root.dataset.accent = settings.accentColor ?? DEFAULT_SETTINGS.accentColor;
  root.dataset.textSize = settings.textSize ?? DEFAULT_SETTINGS.textSize;
  if (settings.reduceMotion) root.dataset.motion = "reduce";
  else delete root.dataset.motion;
}
