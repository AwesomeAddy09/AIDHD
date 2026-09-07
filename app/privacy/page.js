import Link from "next/link";
import { TOKENS } from "@/lib/theme";

export const metadata = {
  title: "Privacy, aidhd.",
};

export default function PrivacyPage() {
  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "var(--font-body), sans-serif", color: TOKENS.ink }}>
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/" style={{ color: TOKENS.sub, fontSize: "13px", textDecoration: "none" }}>
          ← Back
        </Link>

        <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "28px", margin: "16px 0 4px" }}>
          Privacy
        </h1>
        <p style={{ color: TOKENS.sub, fontSize: "14px", margin: "0 0 28px" }}>
          Last updated September 2026
        </p>

        <div style={{ background: TOKENS.neutralBg, color: TOKENS.ink, borderRadius: "10px", padding: "14px 16px", fontSize: "14px", lineHeight: 1.6, marginBottom: "28px" }}>
          aidhd is currently in early testing. This page is a plain-language summary of how your
          data is handled. It&apos;s not a substitute for a full legal privacy policy, which we&apos;ll put
          in place before any wider release.
        </div>

        <Section title="What we store">
          <ul style={list}>
            <li>Your name and email address, used to sign you in</li>
            <li>The tasks you create: their text, category, time estimate, and completion status</li>
            <li>Calendar events you add: title and time</li>
            <li>Your nightly recaps</li>
            <li>
              If you use the optional &quot;Start&quot; button on a task, when you started and
              finished it. This is what lets the app learn your patterns over time
            </li>
          </ul>
        </Section>

        <Section title="How it's stored">
          <p style={para}>
            Everything lives in a Supabase-hosted database, locked down so that only you,
            authenticated as you, can read or write your own data. Other users can&apos;t see it,
            and it&apos;s not something we browse around in casually.
          </p>
        </Section>

        <Section title="What we send to Claude (Anthropic)">
          <p style={para}>
            When you organize a brain dump, break down a task, or generate a nightly recap, the
            relevant text is sent to Anthropic&apos;s Claude API to process it. That&apos;s what
            actually does the organizing. It&apos;s sent directly from our server, and Anthropic&apos;s
            API doesn&apos;t use it to train their models.
          </p>
        </Section>

        <Section title="What we don't do">
          <ul style={list}>
            <li>We don&apos;t sell your data</li>
            <li>We don&apos;t share it with advertisers or other third parties</li>
            <li>We don&apos;t use tracking or analytics cookies, only the one essential cookie that keeps you signed in</li>
          </ul>
        </Section>

        <Section title="Your control">
          <p style={para}>
            You can delete any task or event yourself, any time, right in the app. To delete your
            entire account and everything in it, email{" "}
            <a href="mailto:adam.l.dipietro@gmail.com" style={{ color: TOKENS.ink }}>
              adam.l.dipietro@gmail.com
            </a>{" "}
            and it&apos;ll be taken care of.
          </p>
        </Section>

        <Section title="Questions">
          <p style={para}>
            Reach out any time at{" "}
            <a href="mailto:adam.l.dipietro@gmail.com" style={{ color: TOKENS.ink }}>
              adam.l.dipietro@gmail.com
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 style={{ fontSize: "15px", fontWeight: 500, margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}

const para = { fontSize: "14px", lineHeight: 1.6, color: TOKENS.ink, margin: 0 };
const list = { fontSize: "14px", lineHeight: 1.7, color: TOKENS.ink, margin: 0, paddingLeft: "20px", listStyle: "disc" };
