"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const resp = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (resp.ok) {
      router.push("/");
    } else {
      const data = await resp.json();
      setError(data.error ?? "Login failed");
    }
    setLoading(false);
  }

  return (
    <div className="panel" style={{ maxWidth: 400, margin: "48px auto" }}>
      <div className="panel-header">LOGIN</div>
      <div className="panel-body">
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, color: "var(--amber)", marginBottom: 4, letterSpacing: 1 }}>
              API KEY
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{
                width: "100%",
                background: "var(--bg)",
                border: "1px solid var(--green-dim)",
                color: "var(--green)",
                fontFamily: "var(--mono)",
                fontSize: 13,
                padding: "8px 12px",
              }}
              placeholder="cl_..."
              autoFocus
            />
          </div>
          {error && (
            <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>
              {error}
            </div>
          )}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "[AUTHENTICATING...]" : "[LOGIN]"}
          </button>
        </form>
        <div style={{ marginTop: 16, fontSize: 11, color: "var(--gray-lt)" }}>
          Generate a key: <code style={{ color: "var(--cyan)" }}>npm run cli -- create-key --user NAME</code>
        </div>
      </div>
    </div>
  );
}
