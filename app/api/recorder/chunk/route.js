import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { transcribeAudio } from "@/lib/openai";

// Stay well under Vercel's ~4.5MB request body cap — the recorder
// restarts itself every couple of minutes specifically to keep segments
// small, this is just a backstop against a misbehaving client.
const MAX_BYTES = 4 * 1024 * 1024;

// One short audio segment in, its transcript text out. The segment is
// never written to disk or a database here — just handed straight to
// the transcription API and discarded once this request returns.
export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await checkRateLimit(supabase, user.id, "recorder_chunk", [
    { limit: 90, windowSeconds: 600 },
    { limit: 400, windowSeconds: 86400 },
  ]);
  if (!allowed) {
    return NextResponse.json({ error: "You've hit today's limit for this, try again in a bit." }, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("audio");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That segment was too large" }, { status: 413 });
  }

  try {
    const text = await transcribeAudio(file, file.name || "segment.webm");
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: "Couldn't transcribe that part. Try again." }, { status: 502 });
  }
}
