"use client";

import { useState } from "react";

export default function ShareButton({ sessionId }: { sessionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const resp = await fetch(`${base}/api/sessions/${sessionId}/share`, {
      method: "POST",
    });
    const data = await resp.json();
    setUrl(data.url);
    setLoading(false);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button className="btn btn-amber" onClick={handleShare} disabled={loading}>
        {loading ? "[CREATING...]" : "[SHARE SESSION]"}
      </button>
      {url && (
        <span className="share-badge" style={{ marginLeft: 12 }}>
          {url}
        </span>
      )}
    </div>
  );
}
