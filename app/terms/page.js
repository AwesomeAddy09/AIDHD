import Link from "next/link";
import { TOKENS } from "@/lib/theme";

export const metadata = {
  title: "Terms, aidhd.",
};

export default function TermsPage() {
  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "var(--font-body), sans-serif", color: TOKENS.ink }}>
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/" style={{ color: TOKENS.sub, fontSize: "13px", textDecoration: "none" }}>
          ← Back
        </Link>

        <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "28px", margin: "16px 0 4px" }}>
          Terms of service
        </h1>
        <p style={{ color: TOKENS.sub, fontSize: "14px", margin: "0 0 28px" }}>
          Last updated September 2026
        </p>

        <div style={{ background: TOKENS.neutralBg, color: TOKENS.ink, borderRadius: "10px", padding: "14px 16px", fontSize: "14px", lineHeight: 1.6, marginBottom: "28px" }}>
          aidhd is currently in early testing. This page is a plain-language summary, not a
          substitute for a full legal terms of service, which we&apos;ll put in place before any
          wider release. See also the{" "}
          <Link href="/privacy" style={{ color: TOKENS.ink }}>privacy page</Link>.
        </div>

        <Section title="Recording other people" id="recording">
          <p style={para}>
            The Lesson Recorder lets you record audio (a class, a meeting, anything you&apos;re
            worried about zoning out during) and get back a transcript and summary. Recording
            other people without their knowledge or consent is regulated differently depending on
            where you are: some places only require one participant (you) to consent, others
            require everyone being recorded to agree first.
          </p>
          <p style={para}>
            It&apos;s your responsibility to know and follow the rules that apply to you, and to get
            consent from anyone else being recorded when it&apos;s required. Don&apos;t use this feature
            to record someone in a way that isn&apos;t legal where you are.
          </p>
        </Section>

        <Section title="What happens to a recording">
          <ul style={list}>
            <li>The raw audio itself is never stored. It&apos;s transcribed and then discarded immediately</li>
            <li>The resulting transcript and summary are kept only until you tap Discard, whenever that is</li>
            <li>Nothing about a recording is deleted automatically or on a timer, it stays until you decide you&apos;re done with it</li>
          </ul>
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

function Section({ title, children, id }) {
  return (
    <section className="mb-8" id={id}>
      <h2 style={{ fontSize: "15px", fontWeight: 500, margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}

const para = { fontSize: "14px", lineHeight: 1.6, color: TOKENS.ink, margin: "0 0 10px" };
const list = { fontSize: "14px", lineHeight: 1.7, color: TOKENS.ink, margin: 0, paddingLeft: "20px", listStyle: "disc" };
