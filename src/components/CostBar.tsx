import type { Stats } from "@/lib/types";

export default function CostBar({ stats }: { stats: Stats }) {
  const hasTokens = stats.total_input_tokens > 0 || stats.total_output_tokens > 0;

  if (!hasTokens) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>TOKEN USAGE</span>
        <span>${stats.total_cost_usd.toFixed(4)} estimated</span>
      </div>
      <div className="panel-body stats-bar">
        <div>
          <div className="stat-value">{fmtTokens(stats.total_input_tokens)}</div>
          <div className="stat-label">INPUT TOKENS</div>
        </div>
        <div>
          <div className="stat-value">{fmtTokens(stats.total_output_tokens)}</div>
          <div className="stat-label">OUTPUT TOKENS</div>
        </div>
        <div>
          <div className="stat-value">{fmtTokens(stats.total_input_tokens + stats.total_output_tokens)}</div>
          <div className="stat-label">TOTAL TOKENS</div>
        </div>
        <div>
          <div className="stat-value" style={{ color: "var(--amber)" }}>
            ${stats.total_cost_usd.toFixed(4)}
          </div>
          <div className="stat-label">EST. COST (USD)</div>
        </div>
      </div>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
