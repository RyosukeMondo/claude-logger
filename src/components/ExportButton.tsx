"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ExportButton() {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const params = useSearchParams();
  const user = params.get("user");

  function handleExport() {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const qs = new URLSearchParams({ format });
    if (user) qs.set("user", user);
    window.open(`${base}/api/export?${qs}`, "_blank");
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as "json" | "csv")}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--green-dim)",
          color: "var(--green)",
          fontFamily: "var(--mono)",
          fontSize: 12,
          padding: "4px 8px",
        }}
      >
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
      </select>
      <button className="btn" onClick={handleExport}>
        [EXPORT]
      </button>
    </div>
  );
}
