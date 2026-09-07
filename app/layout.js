import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "aidhd. Stop thinking. Start doing.",
  description: "An AI assistant that handles executive function for people with ADHD.",
};

// Runs before hydration/paint so returning visitors don't see a flash of
// the default theme before their saved one applies — reads the
// localStorage cache written by lib/settings.js, not the server profile
// (that arrives later and reconciles normally).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("aidhd:settings");
    var s = raw ? JSON.parse(raw) : {};
    var theme = s.theme || "system";
    if (theme === "system") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = s.accentColor || "amber";
    root.dataset.textSize = s.textSize || "medium";
    if (s.reduceMotion) root.dataset.motion = "reduce";
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${ibmPlexSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
