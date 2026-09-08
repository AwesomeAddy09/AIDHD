"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOKENS } from "@/lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [devCreds, setDevCreds] = useState(null); // { email, password }, only ever set outside production

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev-login")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setDevCreds(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const signInAsAdminTest = async () => {
    if (!devCreds) return;
    setError("");
    setNotice("");
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword(devCreds);
      if (signInError) throw signInError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (resetError) throw resetError;
        setNotice("If there's an account for that email, a reset link is on its way.");
        return;
      }
      if (mode === "signup") {
        if (!agreedToTerms) {
          setError("Please agree to the terms of service and privacy policy to continue.");
          setLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim() || email.split("@")[0],
              terms_accepted_at: new Date().toISOString(),
            },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: TOKENS.bg,
        minHeight: "100vh",
        fontFamily: "var(--font-body), sans-serif",
        color: TOKENS.ink,
        display: "flex",
        justifyContent: "center",
        padding: "16px",
        paddingTop: "min(15vh, 96px)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: TOKENS.card,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: "14px",
          padding: "32px 28px",
          width: "340px",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display), serif",
            fontWeight: 600,
            fontSize: "28px",
            margin: "0 0 4px",
          }}
        >
          aidhd.
        </h1>
        <p style={{ color: TOKENS.sub, fontSize: "14px", margin: "0 0 20px" }}>
          Stop thinking. Start doing.
        </p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", marginBottom: "6px" }}>
                What should we call you?
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </>
          )}

          <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", margin: "12px 0 6px" }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />

          {mode !== "forgot" && (
            <>
              <label style={{ fontSize: "13px", color: TOKENS.sub, display: "block", margin: "12px 0 6px" }}>
                Password
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
            </>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
                setNotice("");
              }}
              style={{ background: "none", border: "none", color: TOKENS.sub, fontSize: "12px", cursor: "pointer", padding: 0, marginTop: "8px" }}
            >
              Forgot password?
            </button>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2" style={{ marginTop: "14px", fontSize: "12px", color: TOKENS.sub, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: "2px", flexShrink: 0 }}
              />
              <span>
                By continuing, you agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: TOKENS.ink }}>Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: TOKENS.ink }}>Privacy Policy</a>.
              </span>
            </label>
          )}

          {error && (
            <p style={{ color: TOKENS.overflow, fontSize: "13px", marginTop: "12px" }}>{error}</p>
          )}
          {notice && (
            <p style={{ color: TOKENS.calmText, fontSize: "13px", marginTop: "12px" }}>{notice}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "16px",
              width: "100%",
              background: TOKENS.now,
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "One sec…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup");
            setError("");
            setNotice("");
          }}
          style={{
            marginTop: "14px",
            width: "100%",
            background: "none",
            border: "none",
            color: TOKENS.sub,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : mode === "forgot" ? "Back to sign in" : "New here? Create an account"}
        </button>

        {devCreds && (
          <button
            onClick={signInAsAdminTest}
            disabled={loading}
            style={{
              marginTop: "14px",
              width: "100%",
              background: "none",
              border: `1px dashed ${TOKENS.border}`,
              color: TOKENS.sub,
              borderRadius: "8px",
              padding: "8px",
              fontSize: "12px",
              cursor: loading ? "default" : "pointer",
            }}
          >
            Administrator test account (dev only)
          </button>
        )}

        <a href="/privacy" style={{ display: "block", textAlign: "center", marginTop: "10px", color: TOKENS.sub, fontSize: "12px", textDecoration: "none" }}>
          Privacy
        </a>
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
