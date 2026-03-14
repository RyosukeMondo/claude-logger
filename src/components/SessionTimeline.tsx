import Link from "next/link";
import type { Session } from "@/lib/types";

const GAP_THRESHOLD_MS = 30 * 60 * 1000; // 30 min
const GAP_WIDTH_PX = 24;
const ROW_HEIGHT = 28;
const ROW_GAP = 4;
const LABEL_WIDTH = 100;
const MIN_BAR_WIDTH = 4;

interface Block {
  start: number;
  end: number;
  offsetPx: number;
  widthPx: number;
}

export default function SessionTimeline({ sessions }: { sessions: Session[] }) {
  const timed = sessions
    .filter((s) => s.started_at)
    .map((s) => ({
      ...s,
      startMs: new Date(s.started_at!).getTime(),
      endMs: s.ended_at
        ? new Date(s.ended_at).getTime()
        : new Date(s.started_at!).getTime() + 10 * 60 * 1000, // default 10 min if no end
    }))
    .sort((a, b) => a.startMs - b.startMs);

  if (timed.length === 0) return null;

  // Build activity blocks by merging overlapping/close ranges
  const blocks = buildBlocks(timed);

  // Compute pixel layout for blocks
  const totalDuration = blocks.reduce((s, b) => s + (b.end - b.start), 0);
  if (totalDuration === 0) return null;

  const gapCount = Math.max(0, blocks.length - 1);
  const totalGapPx = gapCount * GAP_WIDTH_PX;
  const availableWidth = 100; // percentage
  // We'll use a mix: gaps are fixed px, blocks are proportional

  // Assign rows (swim lanes) for concurrency
  const lanes = assignLanes(timed);
  const laneCount = Math.max(...lanes) + 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>SESSION TIMELINE</span>
        <span>{timed.length} sessions</span>
      </div>
      <div className="panel-body">
        {/* Time axis labels */}
        <div className="st-axis">
          {blocks.map((block, i) => (
            <div key={i} className="st-axis-block" style={{ flex: block.end - block.start }}>
              <span>{fmtTime(block.start)}</span>
              <span>{fmtTime(block.end)}</span>
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div
          className="st-chart"
          style={{ height: laneCount * (ROW_HEIGHT + ROW_GAP) + ROW_GAP }}
        >
          {/* Block backgrounds and gap markers */}
          <div className="st-blocks">
            {blocks.map((block, i) => (
              <div key={i} className="st-block-bg" style={{ flex: block.end - block.start }}>
                {i > 0 && <div className="st-gap">⋯</div>}
              </div>
            ))}
          </div>

          {/* Session bars */}
          {timed.map((s, si) => {
            const segments = getBarSegments(s.startMs, s.endMs, blocks, totalDuration);
            if (segments.length === 0) return null;

            return segments.map((seg, segi) => (
              <Link
                key={`${s.id}-${segi}`}
                href={`/sessions/${s.id}`}
                className="st-bar"
                style={{
                  top: ROW_GAP + lanes[si] * (ROW_HEIGHT + ROW_GAP),
                  left: `${seg.leftPct}%`,
                  width: `max(${MIN_BAR_WIDTH}px, ${seg.widthPct}%)`,
                  height: ROW_HEIGHT,
                }}
                title={`${s.username || "?"} — ${s.started_at?.slice(11, 16)} → ${s.ended_at?.slice(11, 16) ?? "ongoing"} (${s.event_count} events)`}
              >
                <span className="st-bar-label">
                  {s.username || s.id.slice(0, 8)}
                </span>
              </Link>
            ));
          })}
        </div>
      </div>
    </div>
  );
}

/** Merge overlapping / close session ranges into blocks. */
function buildBlocks(
  sessions: { startMs: number; endMs: number }[]
): { start: number; end: number }[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort((a, b) => a.startMs - b.startMs);
  const blocks: { start: number; end: number }[] = [
    { start: sorted[0].startMs, end: sorted[0].endMs },
  ];

  for (const s of sorted.slice(1)) {
    const last = blocks[blocks.length - 1];
    if (s.startMs - last.end <= GAP_THRESHOLD_MS) {
      last.end = Math.max(last.end, s.endMs);
    } else {
      blocks.push({ start: s.startMs, end: s.endMs });
    }
  }

  return blocks;
}

/** Assign swim-lane indices to avoid overlap. */
function assignLanes(sessions: { startMs: number; endMs: number }[]): number[] {
  const laneEnds: number[] = [];
  return sessions.map((s) => {
    for (let i = 0; i < laneEnds.length; i++) {
      if (s.startMs >= laneEnds[i]) {
        laneEnds[i] = s.endMs;
        return i;
      }
    }
    laneEnds.push(s.endMs);
    return laneEnds.length - 1;
  });
}

/** Map a session's time range to percentage positions across blocks. */
function getBarSegments(
  startMs: number,
  endMs: number,
  blocks: { start: number; end: number }[],
  totalDuration: number
): { leftPct: number; widthPct: number }[] {
  const segments: { leftPct: number; widthPct: number }[] = [];
  let cumulativeMs = 0;

  for (const block of blocks) {
    const blockDur = block.end - block.start;
    const segStart = Math.max(startMs, block.start);
    const segEnd = Math.min(endMs, block.end);

    if (segStart < segEnd) {
      const offsetInBlock = segStart - block.start;
      const segDur = segEnd - segStart;
      const leftPct = ((cumulativeMs + offsetInBlock) / totalDuration) * 100;
      const widthPct = (segDur / totalDuration) * 100;
      segments.push({ leftPct, widthPct });
    }

    cumulativeMs += blockDur;
  }

  return segments;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mo}/${dd} ${hh}:${mm}`;
}
