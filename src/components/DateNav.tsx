"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function DateNav({ date }: { date: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function navigate(d: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("date", d);
    router.push(`/?${sp.toString()}`);
  }

  function shift(days: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    navigate(fmt(d));
  }

  const today = fmt(new Date());
  const isToday = date === today;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button className="btn" onClick={() => shift(-1)}>{"<"}</button>
      <span style={{ color: "var(--cyan)", letterSpacing: 1, fontSize: 13 }}>{date}</span>
      <button className="btn" onClick={() => shift(1)} disabled={isToday}>{">"}</button>
      {!isToday && (
        <button className="btn" onClick={() => navigate(today)}>TODAY</button>
      )}
    </div>
  );
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
