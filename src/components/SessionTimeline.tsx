import Link from "next/link";
import type { Session } from "@/lib/types";

const PROMPT_DURATION_MS = 10 * 60 * 1000;
const GAP_THRESHOLD_MS = 30 * 60 * 1000;
const ROW_HEIGHT = 28;
const ROW_GAP = 4;
const MIN_BAR_WIDTH = 4;

const USER_PALETTE = [
  { bg: "#00aa2a", border: "#00ff41", glow: "rgba(0,255,65,0.3)", text: "#0a0e14" },
  { bg: "#0088bb", border: "#00d4ff", glow: "rgba(0,212,255,0.3)", text: "#0a0e14" },
  { bg: "#aa7700", border: "#ffb000", glow: "rgba(255,176,0,0.3)", text: "#0a0e14" },
  { bg: "#aa2244", border: "#ff3366", glow: "rgba(255,51,102,0.3)", text: "#fff" },
  { bg: "#7733aa", border: "#bb66ff", glow: "rgba(187,102,255,0.3)", text: "#fff" },
  { bg: "#22aa88", border: "#44ffcc", glow: "rgba(68,255,204,0.3)", text: "#0a0e14" },
  { bg: "#aa5500", border: "#ff8800", glow: "rgba(255,136,0,0.3)", text: "#0a0e14" },
  { bg: "#3366aa", border: "#5599ff", glow: "rgba(85,153,255,0.3)", text: "#fff" },
];

interface ActivityRange {
  sessionId: string;
  username: string;
  promptCount: number;
  startMs: number;
  endMs: number;
}

interface Props {
  sessions: Session[];
  promptMap: Record<string, number[]>;
  date: string;
}

export default function SessionTimeline({ sessions, promptMap, date }: Props) {
  // Build user -> color mapping
  const usernames = [...new Set(sessions.map((s) => s.username).filter(Boolean))];
  const userColor = new Map<string, (typeof USER_PALETTE)[0]>();
  usernames.forEach((u, i) => userColor.set(u, USER_PALETTE[i % USER_PALETTE.length]));

  // Build activity ranges from prompt timestamps
  const allRanges: ActivityRange[] = [];
  for (const s of sessions) {
    const timestamps = promptMap[s.id];
    if (!timestamps || timestamps.length === 0) continue;

    const merged = mergePromptWindows(timestamps);
    for (const range of merged) {
      allRanges.push({
        sessionId: s.id,
        username: s.username || s.id.slice(0, 8),
        promptCount: timestamps.filter((t) => t >= range.start && t < range.end).length,
        startMs: range.start,
        endMs: range.end,
      });
    }
  }

  if (allRanges.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span>ACTIVITY TIMELINE</span>
          <span>{date}</span>
        </div>
        <div className="panel-body" style={{ color: "var(--gray-lt)", textAlign: "center", padding: 24 }}>
          NO PROMPT ACTIVITY ON THIS DATE
        </div>
      </div>
    );
  }

  allRanges.sort((a, b) => a.startMs - b.startMs);

  const blocks = buildBlocks(allRanges);
  const totalDuration = blocks.reduce((s, b) => s + (b.end - b.start), 0);
  if (totalDuration === 0) return null;

  const lanes = assignLanes(allRanges);
  const laneCount = Math.max(...lanes) + 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>ACTIVITY TIMELINE</span>
        <span>{allRanges.length} blocks / {date}</span>
      </div>
      <div className="panel-body">
        {/* Legend */}
        {usernames.length > 1 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
            {usernames.map((u) => {
              const c = userColor.get(u)!;
              return (
                <span key={u} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: 2,
                    background: c.bg, border: `1px solid ${c.border}`,
                    display: "inline-block",
                  }} />
                  {u}
                </span>
              );
            })}
          </div>
        )}

        {/* Time axis */}
        <div className="st-axis">
          {blocks.map((block, i) => (
            <div key={i} className="st-axis-block" style={{ flex: block.end - block.start }}>
              <span>{fmtTime(block.start)}</span>
              <span>{fmtTime(block.end)}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="st-chart" style={{ height: laneCount * (ROW_HEIGHT + ROW_GAP) + ROW_GAP }}>
          <div className="st-blocks">
            {blocks.map((block, i) => (
              <div key={i} className="st-block-bg" style={{ flex: block.end - block.start }}>
                {i > 0 && <div className="st-gap">⋯</div>}
              </div>
            ))}
          </div>

          {allRanges.map((r, ri) => {
            const segments = getBarSegments(r.startMs, r.endMs, blocks, totalDuration);
            const c = userColor.get(r.username) ?? USER_PALETTE[0];

            return segments.map((seg, si) => (
              <Link
                key={`${r.sessionId}-${ri}-${si}`}
                href={`/sessions/${r.sessionId}`}
                className="st-bar"
                style={{
                  top: ROW_GAP + lanes[ri] * (ROW_HEIGHT + ROW_GAP),
                  left: `${seg.leftPct}%`,
                  width: `max(${MIN_BAR_WIDTH}px, ${seg.widthPct}%)`,
                  height: ROW_HEIGHT,
                  background: c.bg,
                  borderColor: c.border,
                  boxShadow: `0 0 4px ${c.glow}`,
                }}
                title={`${r.username} — ${fmtShort(r.startMs)} → ${fmtShort(r.endMs)} (${r.promptCount} prompts)`}
              >
                <span className="st-bar-label" style={{ color: c.text }}>{r.username}</span>
              </Link>
            ));
          })}
        </div>
      </div>
    </div>
  );
}

function mergePromptWindows(timestamps: number[]): { start: number; end: number }[] {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [
    { start: sorted[0], end: sorted[0] + PROMPT_DURATION_MS },
  ];
  for (const ts of sorted.slice(1)) {
    const last = ranges[ranges.length - 1];
    const windowEnd = ts + PROMPT_DURATION_MS;
    if (ts <= last.end) {
      last.end = Math.max(last.end, windowEnd);
    } else {
      ranges.push({ start: ts, end: windowEnd });
    }
  }
  return ranges;
}

function buildBlocks(ranges: { startMs: number; endMs: number }[]): { start: number; end: number }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startMs - b.startMs);
  const blocks: { start: number; end: number }[] = [
    { start: sorted[0].startMs, end: sorted[0].endMs },
  ];
  for (const r of sorted.slice(1)) {
    const last = blocks[blocks.length - 1];
    if (r.startMs - last.end <= GAP_THRESHOLD_MS) {
      last.end = Math.max(last.end, r.endMs);
    } else {
      blocks.push({ start: r.startMs, end: r.endMs });
    }
  }
  return blocks;
}

function assignLanes(ranges: { startMs: number; endMs: number }[]): number[] {
  const laneEnds: number[] = [];
  return ranges.map((r) => {
    for (let i = 0; i < laneEnds.length; i++) {
      if (r.startMs >= laneEnds[i]) {
        laneEnds[i] = r.endMs;
        return i;
      }
    }
    laneEnds.push(r.endMs);
    return laneEnds.length - 1;
  });
}

function getBarSegments(
  startMs: number, endMs: number,
  blocks: { start: number; end: number }[], totalDuration: number
): { leftPct: number; widthPct: number }[] {
  const segments: { leftPct: number; widthPct: number }[] = [];
  let cumulativeMs = 0;
  for (const block of blocks) {
    const blockDur = block.end - block.start;
    const segStart = Math.max(startMs, block.start);
    const segEnd = Math.min(endMs, block.end);
    if (segStart < segEnd) {
      const leftPct = ((cumulativeMs + segStart - block.start) / totalDuration) * 100;
      const widthPct = ((segEnd - segStart) / totalDuration) * 100;
      segments.push({ leftPct, widthPct });
    }
    cumulativeMs += blockDur;
  }
  return segments;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtShort(ms: number): string {
  return fmtTime(ms);
}
