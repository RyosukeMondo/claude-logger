import Link from "next/link";
import type { Session } from "@/lib/types";

const PROMPT_DURATION_MS = 10 * 60 * 1000; // each prompt = 10 min activity
const GAP_THRESHOLD_MS = 30 * 60 * 1000; // compress gaps > 30 min
const ROW_HEIGHT = 28;
const ROW_GAP = 4;
const MIN_BAR_WIDTH = 4;

interface ActivityRange {
  sessionId: string;
  username: string;
  promptCount: number;
  startMs: number;
  endMs: number;
}

interface Props {
  sessions: Session[];
  promptMap: Record<string, number[]>; // session_id -> prompt epoch ms[]
}

export default function SessionTimeline({ sessions, promptMap }: Props) {
  // Build activity ranges from prompt timestamps
  const allRanges: ActivityRange[] = [];
  for (const s of sessions) {
    const timestamps = promptMap[s.id];
    if (!timestamps || timestamps.length === 0) continue;

    // Merge overlapping prompt windows within a session
    const merged = mergePromptWindows(timestamps);
    for (const range of merged) {
      allRanges.push({
        sessionId: s.id,
        username: s.username || s.id.slice(0, 8),
        promptCount: timestamps.filter(
          (t) => t >= range.start && t < range.end
        ).length,
        startMs: range.start,
        endMs: range.end,
      });
    }
  }

  if (allRanges.length === 0) return null;

  allRanges.sort((a, b) => a.startMs - b.startMs);

  // Build compressed time blocks
  const blocks = buildBlocks(allRanges);
  const totalDuration = blocks.reduce((s, b) => s + (b.end - b.start), 0);
  if (totalDuration === 0) return null;

  // Assign swim lanes
  const lanes = assignLanes(allRanges);
  const laneCount = Math.max(...lanes) + 1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>ACTIVITY TIMELINE</span>
        <span>{allRanges.length} activity blocks</span>
      </div>
      <div className="panel-body">
        <div className="st-axis">
          {blocks.map((block, i) => (
            <div
              key={i}
              className="st-axis-block"
              style={{ flex: block.end - block.start }}
            >
              <span>{fmtTime(block.start)}</span>
              <span>{fmtTime(block.end)}</span>
            </div>
          ))}
        </div>

        <div
          className="st-chart"
          style={{ height: laneCount * (ROW_HEIGHT + ROW_GAP) + ROW_GAP }}
        >
          <div className="st-blocks">
            {blocks.map((block, i) => (
              <div
                key={i}
                className="st-block-bg"
                style={{ flex: block.end - block.start }}
              >
                {i > 0 && <div className="st-gap">⋯</div>}
              </div>
            ))}
          </div>

          {allRanges.map((r, ri) => {
            const segments = getBarSegments(
              r.startMs,
              r.endMs,
              blocks,
              totalDuration
            );

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
                }}
                title={`${r.username} — ${fmtShort(r.startMs)} → ${fmtShort(r.endMs)} (${r.promptCount} prompts)`}
              >
                <span className="st-bar-label">{r.username}</span>
              </Link>
            ));
          })}
        </div>
      </div>
    </div>
  );
}

/** Convert prompt timestamps into merged activity windows (each prompt = 10 min). */
function mergePromptWindows(
  timestamps: number[]
): { start: number; end: number }[] {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [
    { start: sorted[0], end: sorted[0] + PROMPT_DURATION_MS },
  ];

  for (const ts of sorted.slice(1)) {
    const last = ranges[ranges.length - 1];
    const windowEnd = ts + PROMPT_DURATION_MS;
    if (ts <= last.end) {
      // Overlaps — extend
      last.end = Math.max(last.end, windowEnd);
    } else {
      ranges.push({ start: ts, end: windowEnd });
    }
  }

  return ranges;
}

/** Merge close ranges into compressed time blocks. */
function buildBlocks(
  ranges: { startMs: number; endMs: number }[]
): { start: number; end: number }[] {
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

/** Assign swim-lane indices to avoid overlap. */
function assignLanes(
  ranges: { startMs: number; endMs: number }[]
): number[] {
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

/** Map a time range to percentage positions across blocks. */
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

function fmtShort(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
