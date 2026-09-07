const TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

// One audio segment in, plain text out. Costs money per minute of audio
// (see .env.local.example) — the caller is responsible for never writing
// the audio anywhere before or after this call.
export async function transcribeAudio(file, filename) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Transcription isn't configured yet.");
  }

  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("model", "whisper-1");

  const res = await fetch(TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.text || "";
}
