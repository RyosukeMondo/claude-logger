import type { ConversationTurn } from "@/lib/types";

export default function ConversationView({ turns }: { turns: ConversationTurn[] }) {
  if (turns.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">CONVERSATION</div>
        <div className="panel-body" style={{ color: "var(--gray-lt)", textAlign: "center", padding: 24 }}>
          NO CONVERSATION TURNS FOUND
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>CONVERSATION</span>
        <span>{turns.length} turns</span>
      </div>
      <div className="panel-body">
        {turns.map((turn, i) => (
          <div key={i} className="conv-turn">
            {/* User prompt */}
            <div className="conv-user">
              <div className="conv-role">
                <span className="conv-role-badge conv-role-user">USER</span>
                <span className="conv-time">{turn.prompt_timestamp?.slice(11, 19)}</span>
              </div>
              <div className="conv-bubble conv-bubble-user">
                {turn.prompt}
              </div>
            </div>

            {/* Tool calls */}
            {turn.tool_calls.length > 0 && (
              <div className="conv-tools">
                {turn.tool_calls.map((tc, j) => (
                  <details key={j} className="conv-tool-detail">
                    <summary className="conv-tool-summary">
                      <span className={`conv-tool-badge ${tc.success ? "" : "conv-tool-failed"}`}>
                        {tc.name}
                      </span>
                      <span className="conv-tool-text">{tc.summary}</span>
                      {!tc.success && <span style={{ color: "var(--red)", fontSize: 10 }}> FAILED</span>}
                    </summary>
                    {tc.input && Object.keys(tc.input).length > 0 && (
                      <div className="conv-tool-code">
                        <div style={{ color: "var(--gray-lt)", fontSize: 10, marginBottom: 4 }}>INPUT:</div>
                        <pre>{formatPayload(tc.input)}</pre>
                      </div>
                    )}
                    {tc.response && (
                      <div className="conv-tool-code">
                        <div style={{ color: "var(--gray-lt)", fontSize: 10, marginBottom: 4 }}>OUTPUT:</div>
                        <pre>{formatPayload(tc.response)}</pre>
                      </div>
                    )}
                  </details>
                ))}
              </div>
            )}

            {/* Claude response indicator */}
            {turn.stop_reason && (
              <div className="conv-assistant">
                <div className="conv-role">
                  <span className="conv-role-badge conv-role-assistant">CLAUDE</span>
                  <span className="conv-time">{turn.response_timestamp?.slice(11, 19)}</span>
                </div>
                <div className="conv-bubble conv-bubble-assistant">
                  <span style={{ color: "var(--gray-lt)", fontStyle: "italic" }}>
                    Finished: {turn.stop_reason}
                    {turn.tool_calls.length > 0 && ` (${turn.tool_calls.length} tool call${turn.tool_calls.length !== 1 ? "s" : ""})`}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPayload(obj: Record<string, unknown>): string {
  const s = JSON.stringify(obj, null, 2);
  return s.length > 2000 ? s.slice(0, 2000) + "\n..." : s;
}
