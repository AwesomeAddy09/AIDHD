"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Square, Loader2, Trash2, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TOKENS } from "@/lib/theme";
import {
  fetchProfile, upsertProfile, fetchRecordings, insertRecording, deleteRecording,
} from "@/lib/data";
import RecorderConsentModal from "@/components/RecorderConsentModal";

// The recorder restarts itself on this cadence so every uploaded segment
// is its own small, independently valid audio file (a raw MediaRecorder
// timeslice chunk isn't independently decodable past the first one) and
// comfortably stays under Vercel's ~4.5MB request body limit even on
// browsers that don't honor the requested bitrate.
const SEGMENT_MS = 2 * 60 * 1000;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// Renders the Claude-produced summary's light "## header" / "- bullet"
// structure without pulling in a markdown library for it.
function SummaryView({ text }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <div key={i} style={{ fontSize: "13px", fontWeight: 600, color: TOKENS.ink, margin: i === 0 ? "0 0 6px" : "16px 0 6px" }}>
              {trimmed.slice(3)}
            </div>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <div key={i} style={{ display: "flex", gap: "8px", fontSize: "14px", lineHeight: 1.5, color: TOKENS.ink, marginBottom: "4px" }}>
              <span style={{ color: TOKENS.sub }}>•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        return (
          <p key={i} style={{ fontSize: "14px", lineHeight: 1.5, color: TOKENS.ink, margin: "0 0 6px" }}>
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function RecordingCard({ recording, onDiscard }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const handleDiscard = async () => {
    setDiscarding(true);
    await onDiscard(recording.id);
  };

  return (
    <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
      <div className="flex items-start justify-between mb-1">
        <div style={{ fontSize: "12px", color: TOKENS.sub }}>
          {new Date(recording.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
      <div style={{ fontSize: "11px", color: TOKENS.sub, marginBottom: "12px" }}>
        This will stay here until you discard it.
      </div>

      <SummaryView text={recording.summary} />

      <button
        onClick={() => setShowTranscript((v) => !v)}
        className="flex items-center gap-1"
        style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer", padding: 0, marginTop: "14px" }}
      >
        {showTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showTranscript ? "Hide full transcript" : "Show full transcript"}
      </button>
      {showTranscript && (
        <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.6, color: TOKENS.sub, background: TOKENS.neutralBg, borderRadius: "8px", padding: "12px", whiteSpace: "pre-wrap" }}>
          {recording.transcript}
        </div>
      )}

      <button
        onClick={handleDiscard}
        disabled={discarding}
        className="flex items-center gap-1"
        style={{
          marginTop: "14px", background: "none", border: `1px solid ${TOKENS.border}`, color: TOKENS.overflow,
          borderRadius: "8px", padding: "7px 12px", fontSize: "13px", cursor: discarding ? "default" : "pointer", opacity: discarding ? 0.6 : 1,
        }}
      >
        <Trash2 size={13} /> {discarding ? "Discarding…" : "Discard"}
      </button>
    </div>
  );
}

export default function Recorder({ userId }) {
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  // "idle" | "recording" | "processing"
  const [recordingState, setRecordingState] = useState("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Computed once at mount (matches the lazy-initializer pattern used
  // elsewhere in this app for browser-capability checks) rather than set
  // from inside an effect body.
  const [supported] = useState(
    () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"
  );

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const stoppingRef = useRef(false);
  const segmentIndexRef = useRef(0);
  const segmentsRef = useRef([]);
  const pendingUploadsRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const segmentTimeoutRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([fetchProfile(supabase), fetchRecordings(supabase)]);
        setProfile(p);
        setRecordings(r);
      } catch (e) {
        setError("Couldn't load the recorder. Try reloading.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // Release the mic and stop timers if someone navigates away mid-recording.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerIntervalRef.current);
      clearTimeout(segmentTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [recordingState]);

  const uploadSegment = useCallback((index, blob) => {
    const attempt = async () => {
      const formData = new FormData();
      formData.append("audio", blob, `segment-${index}.webm`);
      const res = await fetch("/api/recorder/chunk", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      return data.text || "";
    };
    const promise = attempt()
      .catch(() => attempt())
      .catch(() => "[a section of this recording couldn't be transcribed]");
    pendingUploadsRef.current[index] = promise;
    promise.then((text) => {
      segmentsRef.current[index] = text;
    });
  }, []);

  // beginSegment recurses (each segment kicks off the next one) and also
  // needs to hand off to finishRecording once the user has stopped. Both
  // go through refs kept in sync by the effects below, rather than
  // through direct closure self-reference, so neither is read or written
  // during render.
  const beginSegmentRef = useRef(null);
  const finishRecordingRef = useRef(null);

  const beginSegment = useCallback(
    (stream) => {
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined);
      const index = segmentIndexRef.current++;
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (blob.size > 0) uploadSegment(index, blob);
        if (stoppingRef.current) {
          finishRecordingRef.current?.();
        } else {
          beginSegmentRef.current?.(stream);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      segmentTimeoutRef.current = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, SEGMENT_MS);
    },
    [uploadSegment]
  );

  useEffect(() => {
    beginSegmentRef.current = beginSegment;
  }, [beginSegment]);

  const finishRecording = useCallback(async () => {
    // Only release the mic once the last segment has had a chance to
    // flush its final buffered data via onstop, not before.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const transcriptParts = await Promise.all(pendingUploadsRef.current);
      const transcript = transcriptParts.join("\n\n").trim();
      pendingUploadsRef.current = [];
      segmentsRef.current = [];
      stoppingRef.current = false;

      if (!transcript) {
        setError("Didn't catch any audio in that recording.");
        setRecordingState("idle");
        return;
      }

      const { summary } = await postJson("/api/recorder/summarize", { transcript });
      const saved = await insertRecording(supabase, userId, { transcript, summary });
      setRecordings((prev) => [saved, ...prev]);
      setRecordingState("idle");
    } catch (e) {
      setError(e.message || "Couldn't finish processing that recording.");
      setRecordingState("idle");
    }
  }, [supabase, userId]);

  useEffect(() => {
    finishRecordingRef.current = finishRecording;
  }, [finishRecording]);

  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      segmentsRef.current = [];
      pendingUploadsRef.current = [];
      segmentIndexRef.current = 0;
      stoppingRef.current = false;
      setElapsedSeconds(0);
      setRecordingState("recording");
      beginSegment(stream);
      timerIntervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError("Couldn't access the microphone. Check your browser's permission settings and try again.");
    }
  }, [beginSegment]);

  const handleRecordTap = () => {
    if (!profile?.recorderConsentAckAt) {
      setShowConsent(true);
      return;
    }
    startRecording();
  };

  const handleAcknowledgeConsent = async () => {
    setShowConsent(false);
    const ackAt = new Date().toISOString();
    setProfile((p) => ({ ...p, recorderConsentAckAt: ackAt }));
    try {
      await upsertProfile(supabase, userId, { recorder_consent_ack_at: ackAt });
    } catch (e) {
      // Not fatal — the notice will just show again next time.
    }
    startRecording();
  };

  const stopRecording = () => {
    stoppingRef.current = true;
    clearInterval(timerIntervalRef.current);
    clearTimeout(segmentTimeoutRef.current);
    setRecordingState("processing");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      finishRecording();
    }
  };

  const handleDiscard = useCallback(async (id) => {
    try {
      await deleteRecording(supabase, id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError("Couldn't discard that. Try again.");
    }
  }, [supabase]);

  if (loading) {
    return (
      <div style={{ background: TOKENS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.sub }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ background: TOKENS.bg, minHeight: "100vh", fontFamily: "var(--font-body), sans-serif", color: TOKENS.ink }}>
      <div className="mx-auto max-w-2xl px-5 pt-10" style={{ paddingBottom: "80px" }}>
        <Link href="/" className="flex items-center gap-1" style={{ color: TOKENS.sub, fontSize: "13px", textDecoration: "none", marginBottom: "16px" }}>
          <ArrowLeft size={14} /> Back
        </Link>

        <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "28px", margin: "0 0 4px" }}>
          Lesson Recorder
        </h1>
        <p style={{ color: TOKENS.sub, fontSize: "14px", margin: "0 0 28px" }}>
          Record a lecture, meeting, or anything you&apos;re worried about zoning out during, and
          get back a short summary after.
        </p>

        {error && (
          <div className="mb-6 flex items-center justify-between" style={{ background: TOKENS.overflowBg, color: TOKENS.overflow, borderRadius: "10px", padding: "10px 14px", fontSize: "14px" }}>
            <span>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: TOKENS.overflow, cursor: "pointer" }}>✕</button>
          </div>
        )}

        {!supported && (
          <div style={{ background: TOKENS.neutralBg, color: TOKENS.neutralText, borderRadius: "10px", padding: "14px", fontSize: "14px", marginBottom: "24px" }}>
            Recording isn&apos;t supported in this browser. Try a recent version of Chrome, Edge, or Safari.
          </div>
        )}

        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "14px", padding: "28px", marginBottom: "32px", textAlign: "center" }}>
          {recordingState === "idle" && supported && (
            <button
              onClick={handleRecordTap}
              className="flex items-center justify-center"
              style={{ background: TOKENS.now, border: "none", color: "#fff", borderRadius: "999px", width: "72px", height: "72px", cursor: "pointer", margin: "0 auto" }}
            >
              <Mic size={28} />
            </button>
          )}
          {recordingState === "idle" && (
            <p style={{ fontSize: "13px", color: TOKENS.sub, margin: "14px 0 0" }}>Tap to record</p>
          )}

          {recordingState === "recording" && (
            <>
              <div className="flex items-center justify-center gap-2" style={{ marginBottom: "18px" }}>
                <span
                  className="animate-pulse"
                  style={{ width: "12px", height: "12px", borderRadius: "999px", background: TOKENS.overflow, display: "inline-block" }}
                />
                <span style={{ fontSize: "20px", fontFamily: "var(--font-display), serif" }}>{formatElapsed(elapsedSeconds)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center justify-center gap-2"
                style={{ background: TOKENS.ink, border: "none", color: "#fff", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 500, cursor: "pointer", margin: "0 auto" }}
              >
                <Square size={14} /> Stop
              </button>
            </>
          )}

          {recordingState === "processing" && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={22} className="animate-spin" style={{ color: TOKENS.sub }} />
              <p style={{ fontSize: "13px", color: TOKENS.sub, margin: 0 }}>Transcribing and summarizing…</p>
            </div>
          )}
        </div>

        {recordings.length > 0 && (
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 500, margin: "0 0 14px" }}>Your recordings</h2>
            {recordings.map((r) => (
              <RecordingCard key={r.id} recording={r} onDiscard={handleDiscard} />
            ))}
          </div>
        )}
      </div>

      {showConsent && (
        <RecorderConsentModal
          onAcknowledge={handleAcknowledgeConsent}
          onCancel={() => setShowConsent(false)}
        />
      )}
    </div>
  );
}
