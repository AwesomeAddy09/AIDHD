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
  title: "aidhd. — Stop thinking. Start doing.",
  description: "An AI assistant that handles executive function for people with ADHD.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${ibmPlexSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
