"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SearchResult } from "@/lib/types";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const params = useSearchParams();
  const user = params.get("user") ?? undefined;

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const qs = new URLSearchParams({ q, limit: "20" });
    if (user) qs.set("user", user);
    const resp = await fetch(`${base}/api/search?${qs}`);
    const data = await resp.json();
    setResults(data.results ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  // Ctrl+K to focus
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>SEARCH</span>
        <span style={{ fontSize: 10, color: "var(--gray-lt)" }}>Ctrl+K</span>
      </div>
      <div className="panel-body">
        <div style={{ position: "relative" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search prompts, tools, events..."
            className="search-input"
          />
          {loading && <span className="search-spinner" />}
        </div>

        {open && query.trim() && (
          <div className="search-results">
            {results.length === 0 && !loading && (
              <div style={{ padding: 12, color: "var(--gray-lt)", textAlign: "center" }}>
                No results for &quot;{query}&quot;
              </div>
            )}
            {total > 0 && (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--gray-lt)", borderBottom: "1px solid var(--bg-hl)" }}>
                {total} result{total !== 1 ? "s" : ""}
              </div>
            )}
            {results.map((r) => (
              <Link
                key={r.event.id}
                href={`/sessions/${r.event.session_id}`}
                className="search-result-item"
                onClick={() => setOpen(false)}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`search-dot ${r.event.hook_event_name === "UserPromptSubmit" ? "prompt" : r.event.tool_name ? "tool" : ""}`} />
                  <span style={{ color: "var(--amber)", fontSize: 11 }}>{r.event.hook_event_name}</span>
                  {r.event.tool_name && <span style={{ color: "var(--cyan)", fontSize: 11 }}>{r.event.tool_name}</span>}
                  <span style={{ color: "var(--gray-lt)", fontSize: 10, marginLeft: "auto" }}>{r.event.timestamp?.slice(0, 16)}</span>
                </div>
                <div style={{ color: "var(--green)", fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.event.summary}
                </div>
                <div style={{ fontSize: 10, color: "var(--gray)", marginTop: 2 }}>
                  {r.session_username} / {r.session_project}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
