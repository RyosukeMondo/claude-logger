"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Session } from "@/lib/types";

interface Props {
  initialSessions: Session[];
  user?: string;
  hasMore: boolean;
}

export default function PaginatedSessionTable({ initialSessions, user, hasMore: initialHasMore }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const params = new URLSearchParams({
      limit: "50",
      offset: String(sessions.length),
    });
    if (user) params.set("user", user);

    const resp = await fetch(`${base}/api/sessions?${params}`);
    const data = await resp.json();
    const newSessions = data.sessions ?? data;
    setSessions((prev) => [...prev, ...newSessions]);
    setHasMore(data.hasMore ?? newSessions.length === 50);
    setLoading(false);
  }, [loading, hasMore, sessions.length, user]);

  // Reset when initialSessions change (filter/navigation)
  useEffect(() => {
    setSessions(initialSessions);
    setHasMore(initialHasMore);
  }, [initialSessions, initialHasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (sessions.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">SESSIONS</div>
        <div className="panel-body empty">
          <p>NO SESSIONS RECORDED</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>SESSIONS</span>
        <span>{sessions.length} loaded{hasMore ? "+" : ""}</span>
      </div>
      <div className="panel-body">
        <table className="tt">
          <thead>
            <tr>
              <th>SESSION ID</th>
              <th>USER</th>
              <th>PROJECT</th>
              <th>EVENTS</th>
              <th>PROMPTS</th>
              <th>TOOLS</th>
              <th>COST</th>
              <th>STARTED</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/sessions/${s.id}`}>{s.id.slice(0, 12)}...</Link>
                </td>
                <td style={{ color: "var(--cyan)" }}>{s.username || "-"}</td>
                <td>{s.project_name || shortPath(s.project_dir)}</td>
                <td>{s.event_count}</td>
                <td>{s.prompt_count}</td>
                <td>{s.tool_count}</td>
                <td style={{ color: "var(--amber)" }}>
                  {s.total_cost_usd > 0 ? `$${s.total_cost_usd.toFixed(4)}` : "-"}
                </td>
                <td>{s.started_at?.slice(0, 19) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loading && (
          <div style={{ textAlign: "center", padding: 12, color: "var(--gray-lt)" }}>
            Loading more sessions...
          </div>
        )}
        {!hasMore && sessions.length > 50 && (
          <div style={{ textAlign: "center", padding: 8, color: "var(--gray)", fontSize: 11 }}>
            All sessions loaded
          </div>
        )}
      </div>
    </div>
  );
}

function shortPath(p: string): string {
  if (!p) return "-";
  return p.replace(/^\/home\/[^/]+/, "~");
}
