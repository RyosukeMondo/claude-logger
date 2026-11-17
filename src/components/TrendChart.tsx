import type { DailyTrend } from "@/lib/types";

export default function TrendChart({ trends }: { trends: DailyTrend[] }) {
  if (trends.length === 0) {
    return <div style={{ color: "var(--gray-lt)", textAlign: "center", padding: 24 }}>NO DATA</div>;
  }

  const maxEvents = Math.max(...trends.map((t) => t.events), 1);
  const maxPrompts = Math.max(...trends.map((t) => t.prompts), 1);

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--gray-lt)", marginBottom: 8 }}>
        <span style={{ display: "inline-block", width: 12, height: 12, background: "var(--green-dim)", marginRight: 4, verticalAlign: "middle" }} /> Events
        {" "}
        <span style={{ display: "inline-block", width: 12, height: 12, background: "var(--cyan)", marginRight: 4, marginLeft: 12, verticalAlign: "middle" }} /> Prompts
      </div>

      {trends.map((t) => (
        <div key={t.date} className="trend-row">
          <span className="trend-date">{t.date.slice(5)}</span>
          <div className="trend-bars">
            <div className="trend-bar-track">
              <div
                className="trend-bar-fill"
                style={{ width: `${(t.events / maxEvents) * 100}%`, background: "var(--green-dim)" }}
              />
            </div>
            <div className="trend-bar-track">
              <div
                className="trend-bar-fill"
                style={{ width: `${(t.prompts / maxPrompts) * 100}%`, background: "var(--cyan)" }}
              />
            </div>
          </div>
          <span className="trend-counts">
            {t.events}e / {t.prompts}p / {t.sessions}s
          </span>
        </div>
      ))}
    </div>
  );
}
