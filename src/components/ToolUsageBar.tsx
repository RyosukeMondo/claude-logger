export default function ToolUsageBar({
  tools,
}: {
  tools: { name: string; count: number }[];
}) {
  if (tools.length === 0) return null;
  const max = Math.max(...tools.map((t) => t.count), 1);

  return (
    <div className="panel">
      <div className="panel-header">TOOL USAGE</div>
      <div className="panel-body">
        {tools.map((t) => (
          <div key={t.name} className="tool-bar">
            <span className="tool-bar-name">{t.name}</span>
            <div style={{ flex: 1, background: "rgba(0,255,65,0.05)" }}>
              <div
                className="tool-bar-fill"
                style={{ width: `${Math.round((t.count / max) * 100)}%` }}
              />
            </div>
            <span className="tool-bar-count">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
