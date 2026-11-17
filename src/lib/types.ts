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
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  [key: string]: unknown;
}

export interface Session {
  id: string;
  username: string;
  project_dir: string;
  project_name: string;
  started_at: string | null;
  ended_at: string | null;
  permission_mode: string | null;
  event_count: number;
  prompt_count: number;
  tool_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
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
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
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

// --- Feature 1: Search ---
export interface SearchResult {
  event: EventRecord;
  session_username: string;
  session_project: string;
  rank: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

// --- Feature 2: Costs ---
export interface CostSummary {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface AggregateCosts {
  total: CostSummary;
  by_session: { session_id: string; username: string; cost: CostSummary }[];
}

// --- Feature 3: Analytics ---
export interface DailyTrend {
  date: string;
  sessions: number;
  events: number;
  prompts: number;
  tools: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface ToolTrend {
  date: string;
  tool_name: string;
  count: number;
}

export interface HeatmapCell {
  day_of_week: number; // 0=Sun, 6=Sat
  hour: number; // 0-23
  count: number;
}

// --- Feature 4: Auth ---
export interface AuthContext {
  username: string;
  role: "admin" | "viewer";
  key_id?: number;
}

// --- Feature 5: Conversation ---
export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  response: Record<string, unknown> | null;
  success: boolean;
  summary: string;
}

export interface ConversationTurn {
  prompt: string;
  prompt_timestamp: string;
  tool_calls: ToolCall[];
  stop_reason: string | null;
  response_timestamp: string | null;
}

// --- Feature 6: Lifecycle ---
export interface RetentionConfig {
  max_age_days: number;
  auto_prune_enabled: boolean;
  last_pruned_at: string | null;
}

export interface PruneResult {
  sessions_deleted: number;
  events_deleted: number;
  shares_deleted: number;
}

// --- Feature 7: Projects ---
export interface ProjectSummary {
  project_name: string;
  project_dir: string;
  session_count: number;
  event_count: number;
  prompt_count: number;
  tool_count: number;
  total_cost_usd: number;
  last_activity: string | null;
}

// --- Feature 10: Queue ---
export interface QueueStatus {
  pending: number;
  failed: number;
  oldest_pending: string | null;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  db: "connected" | "disconnected";
  queue: QueueStatus;
  uptime_seconds: number;
}

// --- Feature: Prompt Explorer ---
export interface PromptRecord {
  event_id: number;
  session_id: string;
  username: string;
  project_name: string;
  prompt_text: string;
  timestamp: string;
  duration_seconds: number | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  tool_count: number;
  tool_names: string[];
}

export interface PromptListResult {
  prompts: PromptRecord[];
  total: number;
}

export interface PromptFilters {
  username?: string;
  project?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
