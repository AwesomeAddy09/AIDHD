"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOKENS } from "@/lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() || email.split("@")[0] } },
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
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
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
            {loading ? "One sec…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
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
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
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
