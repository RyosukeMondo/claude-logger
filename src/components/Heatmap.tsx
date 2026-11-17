import type { HeatmapCell } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  if (cells.length === 0) {
    return <div style={{ color: "var(--gray-lt)", textAlign: "center", padding: 24 }}>NO DATA</div>;
  }

  const max = Math.max(...cells.map((c) => c.count), 1);
  const lookup = new Map<string, number>();
  for (const c of cells) {
    lookup.set(`${c.day_of_week}-${c.hour}`, c.count);
  }

  return (
    <div className="heatmap">
      <div className="heatmap-row">
        <div className="heatmap-label" />
        {HOURS.map((h) => (
          <div key={h} className="heatmap-hour-label">
            {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
          </div>
        ))}
      </div>
      {DAYS.map((day, di) => (
        <div key={day} className="heatmap-row">
          <div className="heatmap-label">{day}</div>
          {HOURS.map((h) => {
            const count = lookup.get(`${di}-${h}`) ?? 0;
            const intensity = count > 0 ? Math.max(0.15, count / max) : 0;
            return (
              <div
                key={h}
                className="heatmap-cell"
                style={{
                  background: count > 0
                    ? `rgba(0, 255, 65, ${intensity})`
                    : "var(--bg)",
                }}
                title={`${day} ${String(h).padStart(2, "0")}:00 — ${count} events`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
