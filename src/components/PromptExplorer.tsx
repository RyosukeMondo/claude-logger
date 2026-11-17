"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { PromptRecord } from "@/lib/types";

interface Props {
  initialPrompts: PromptRecord[];
  initialTotal: number;
  projects: string[];
  currentUser?: string;
  currentProject?: string;
  currentSearch?: string;
}

export default function PromptExplorer({
  initialPrompts, initialTotal, projects,
  currentUser, currentProject, currentSearch,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [total, setTotal] = useState(initialTotal);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams(params.toString());
    sp.set("offset", String(prompts.length));
    sp.set("limit", "50");
    try {
      const res = await fetch(`/api/prompts?${sp}`);
      const data = await res.json();
      setPrompts(prev => [...prev, ...data.prompts]);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [params, prompts.length]);

  function updateFilter(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("offset");
    router.push(`/prompts?${sp}`);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("search") as string;
    updateFilter("search", q || null);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>PROMPT EXPLORER</span>
        <span>{total} prompts</span>
      </div>
      <div className="panel-body">
        <div className="prompt-filters">
          <form onSubmit={handleSearch} style={{ flex: 1 }}>
            <input
              type="text"
              name="search"
              className="search-input"
              placeholder="Search prompts..."
              defaultValue={currentSearch ?? ""}
            />
          </form>
          <select
            className="prompt-select"
            value={currentProject ?? ""}
            onChange={(e) => updateFilter("project", e.target.value || null)}
          >
            <option value="">ALL PROJECTS</option>
            {projects.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {prompts.length === 0 && (
          <div style={{ color: "var(--gray-lt)", textAlign: "center", padding: 24 }}>
            NO PROMPTS FOUND
          </div>
        )}

        <div className="prompt-list">
          {prompts.map((p) => (
            <PromptCard
              key={p.event_id}
              prompt={p}
              expanded={expandedId === p.event_id}
              onToggle={() => setExpandedId(expandedId === p.event_id ? null : p.event_id)}
            />
          ))}
        </div>

        {prompts.length < total && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button className="btn" onClick={loadMore} disabled={loading}>
              {loading ? "LOADING..." : `LOAD MORE (${total - prompts.length} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ prompt, expanded, onToggle }: {
  prompt: PromptRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const p = prompt;
  const time = p.timestamp?.slice(11, 19) ?? "";
  const date = p.timestamp?.slice(0, 10) ?? "";
  const preview = p.prompt_text.length > 200
    ? p.prompt_text.slice(0, 200) + "..."
    : p.prompt_text;

  return (
    <div className={`prompt-card ${expanded ? "expanded" : ""}`}>
      <div className="prompt-card-header" onClick={onToggle}>
        <span className="prompt-card-time">{date} {time}</span>
        <span className="prompt-card-user">{p.username || "-"}</span>
        <span className="prompt-card-project">{p.project_name || "-"}</span>
        <span className="prompt-card-expand">{expanded ? "[-]" : "[+]"}</span>
      </div>

      <div className="prompt-card-preview" onClick={onToggle}>
        {expanded ? p.prompt_text : preview}
      </div>

      <div className="prompt-card-metrics">
        <span>
          <span className="prompt-metric-label">DURATION </span>
          <span className="prompt-metric-val">{fmtDuration(p.duration_seconds)}</span>
        </span>
        <span>
          <span className="prompt-metric-label">TOKENS </span>
          <span className="prompt-metric-val">{fmtTokens(p.input_tokens + p.output_tokens)}</span>
        </span>
        <span>
          <span className="prompt-metric-label">TOOLS </span>
          <span className="prompt-metric-val">{p.tool_count}</span>
        </span>
        <span>
          <span className="prompt-metric-label">COST </span>
          <span className="prompt-metric-val">{p.cost_usd > 0 ? `$${p.cost_usd.toFixed(4)}` : "-"}</span>
        </span>
      </div>

      {expanded && (
        <div className="prompt-card-details">
          {p.tool_names.length > 0 && (
            <div className="prompt-card-tools">
              <span className="prompt-metric-label">TOOLS: </span>
              {p.tool_names.map(t => (
                <span key={t} className="prompt-tool-badge">{t}</span>
              ))}
            </div>
          )}
          <div className="prompt-card-actions">
            <Link href={`/sessions/${p.session_id}`} className="btn">
              VIEW SESSION
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtTokens(n: number): string {
  if (n === 0) return "-";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
