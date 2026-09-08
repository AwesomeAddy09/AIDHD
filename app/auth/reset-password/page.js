"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOKENS } from "@/lib/theme";

// Reached by clicking the link in a password-reset email. Supabase's
// browser client auto-detects the recovery token in the URL (works
// whichever link format the email template uses — hash tokens or a PKCE
// code) and fires a PASSWORD_RECOVERY auth event once it's set up a
// temporary session, which is what actually lets updateUser({password})
// below succeed.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    const timeout = setTimeout(() => {
      setReady((r) => {
        if (!r) setExpired(true);
        return r;
      });
    }, 6000);
    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those two passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Couldn't update your password. Try the reset link again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: TOKENS.bg, minHeight: "100vh", fontFamily: "var(--font-body), sans-serif", color: TOKENS.ink,
        display: "flex", justifyContent: "center", padding: "16px", paddingTop: "min(15vh, 96px)", boxSizing: "border-box",
      }}
    >
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.border}`, borderRadius: "14px", padding: "32px 28px", width: "340px", maxWidth: "100%", boxSizing: "border-box" }}>
        <h1 style={{ fontFamily: "var(--font-display), serif", fontWeight: 600, fontSize: "24px", margin: "0 0 4px" }}>
          Set a new password
        </h1>

        {!ready && !expired && (
          <p style={{ color: TOKENS.sub, fontSize: "14px", marginTop: "16px" }}>Checking your link…</p>
        )}

        {expired && (
          <p style={{ color: TOKENS.overflow, fontSize: "14px", marginTop: "16px", lineHeight: 1.5 }}>
            This link may have expired. Go back to the sign-in page and request a new one.
          </p>
        )}

        {ready && (
          <form onSubmit={submit}>
            <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", margin: "16px 0 6px" }}>
              New password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={inputStyle}
            />

            <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", margin: "12px 0 6px" }}>
              Confirm password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
              style={inputStyle}
            />

            {error && (
              <p style={{ color: TOKENS.overflow, fontSize: "13px", marginTop: "12px" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "16px", width: "100%", background: TOKENS.now, color: "#fff", border: "none",
                borderRadius: "8px", padding: "10px", fontSize: "14px", fontWeight: 500,
                cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "One sec…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: "8px",
  padding: "9px 12px",
  fontSize: "16px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
