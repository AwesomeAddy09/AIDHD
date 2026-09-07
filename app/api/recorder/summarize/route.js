import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, user.id, "recorder_summarize", { limit: 10, windowSeconds: 3600 });
  if (!allowed) {
    return NextResponse.json({ error: "Slow down a little, try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript : "";
  if (!transcript.trim()) {
    return NextResponse.json({ error: "Nothing to summarize" }, { status: 400 });
  }

  try {
    const summary = await callClaude(
      `You help someone with ADHD who just recorded a lecture, meeting, or class and wants to catch up on anything they zoned out for. Turn the transcript into a short, scannable, ADHD-friendly summary.

Rules:
- Plain, simple language.
- Organize by topic or chronological flow, whichever fits the material better.
- Use short sections with a "## " header line for each, and short "- " bullet points underneath. Avoid dense paragraphs.
- Pull out key points. Skip filler, small talk, and tangents.
- End with a "## Action items" section listing anything the speaker asked people to do, bring, submit, or follow up on. Omit it entirely if there genuinely were none, don't force it.
- Do not use em dashes.
- The transcript is auto-generated from speech and may contain minor errors or garbled words here and there. Use context to interpret it reasonably, and don't call out transcription errors in the summary.`,
      transcript.slice(0, 100000),
      1500
    );
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: "Couldn't summarize that. Try again." }, { status: 502 });
  }
}
