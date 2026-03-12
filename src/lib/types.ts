/** Incoming hook event from Claude Code. */
export interface HookEvent {
  session_id: string;
  hook_event_name: string;
  cwd?: string;
  permission_mode?: string;
  transcript_path?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  prompt?: string;
  message?: string;
  title?: string;
  notification_type?: string;
  session_source?: string;
  end_reason?: string;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  username: string;
  project_dir: string;
  started_at: string | null;
  ended_at: string | null;
  permission_mode: string | null;
  event_count: number;
  prompt_count: number;
  tool_count: number;
}

export interface EventRecord {
  id: number;
  session_id: string;
  hook_event_name: string;
  tool_name: string | null;
  summary: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface Share {
  id: string;
  session_id: string;
  created_at: string;
  expires_at: string | null;
}

export interface Stats {
  total_sessions: number;
  total_events: number;
  tool_usage: { name: string; count: number }[];
  recent_activity: {
    session_id: string;
    hook_event_name: string;
    tool_name: string | null;
    summary: string;
    timestamp: string;
  }[];
}

/** View model returned by /api/views/dashboard */
export interface DashboardView {
  screen: "dashboard";
  users: string[];
  current_user: string | null;
  stats: Stats;
  sessions: Session[];
}

/** View model returned by /api/views/session/[id] */
export interface SessionView {
  screen: "session";
  session: Session;
  events: EventRecord[];
}

/** View model returned by /api/views/share/[id] */
export interface ShareView {
  screen: "share";
  share: Share;
  session: Session;
  events: EventRecord[];
}
