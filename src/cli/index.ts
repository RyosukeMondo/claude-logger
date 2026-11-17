#!/usr/bin/env tsx
/**
 * CLI for claude-logger - exercises the same lib as the web app.
 *
 * Usage:
 *   npx tsx src/cli/index.ts users
 *   npx tsx src/cli/index.ts sessions [--user X]
 *   npx tsx src/cli/index.ts session <id>
 *   npx tsx src/cli/index.ts events <session-id>
 *   npx tsx src/cli/index.ts stats [--user X]
 *   npx tsx src/cli/index.ts share <session-id>
 *   npx tsx src/cli/index.ts projects [--user X]
 *   npx tsx src/cli/index.ts costs [--user X] [--since YYYY-MM-DD]
 *   npx tsx src/cli/index.ts export [--format json|csv] [--user X]
 *   npx tsx src/cli/index.ts prune [--days N]
 *   npx tsx src/cli/index.ts cleanup-shares
 *   npx tsx src/cli/index.ts create-key --user X [--role admin|viewer] [--label L]
 *   npx tsx src/cli/index.ts health
 *   npx tsx src/cli/index.ts process-queue
 *   npx tsx src/cli/index.ts backfill-projects
 *   npx tsx src/cli/index.ts serve [--port 8111]
 */

import { createPool, initSchema } from "../lib/db";
import { getEvents } from "../lib/events";
import { listUsers, listSessions, getSession, getStats } from "../lib/sessions";
import { createShare } from "../lib/shares";
import { listProjects, backfillProjectNames } from "../lib/projects";
import { getAggregateCosts } from "../lib/costs";
import { exportSessionsCsv, exportSessionsJson, pruneOldData, cleanupExpiredShares } from "../lib/lifecycle";
import { createApiKey } from "../lib/auth";
import { getHealthStatus, processQueue } from "../lib/queue";
import { listPrompts } from "../lib/prompts";

const BANNER = `
 ╔═╗╦  ╔═╗╦ ╦╔╦╗╔═╗  ╦  ╔═╗╔═╗╔═╗╔═╗╦═╗
 ║  ║  ╠═╣║ ║ ║║║╣   ║  ║ ║║ ╦║ ╦║╣ ╠╦╝
 ╚═╝╩═╝╩ ╩╚═╝═╩╝╚═╝  ╩═╝╚═╝╚═╝╚═╝╚═╝╩╚═
           v0.2.0 :: cli
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(BANNER);
    console.log("Commands:");
    console.log("  users                        List all users");
    console.log("  sessions [--user X]          List all sessions");
    console.log("  session <id>                 Show session detail");
    console.log("  events <session-id>          Show events for a session");
    console.log("  stats [--user X]             Show aggregate stats");
    console.log("  share <session-id>           Create a share link");
    console.log("  projects [--user X]          List projects");
    console.log("  costs [--user X] [--since D] Show cost breakdown");
    console.log("  export [--format F] [--user] Export data (json|csv)");
    console.log("  prune [--days N]             Prune old data");
    console.log("  cleanup-shares               Remove expired shares");
    console.log("  create-key --user X [--role] Create API key");
    console.log("  health                       Health check");
    console.log("  process-queue                Process retry queue");
    console.log("  prompts [--user X] [--project P] [--search Q]  Browse prompts");
    console.log("  backfill-projects            Backfill project names");
    console.log("  serve [--port N]             Start the web server");
    process.exit(0);
  }

  if (cmd === "serve") {
    serve(args);
    return;
  }

  const pool = createPool();
  await initSchema(pool);

  switch (cmd) {
    case "users": {
      const users = await listUsers(pool);
      if (users.length === 0) {
        console.log("No users detected.");
        break;
      }
      console.log("Users:");
      for (const u of users) console.log(`  ${u}`);
      break;
    }

    case "sessions": {
      const userIdx = args.indexOf("--user");
      const user = userIdx >= 0 ? args[userIdx + 1] : undefined;
      const sessions = await listSessions(pool, 50, 0, user);
      if (sessions.length === 0) {
        console.log("No sessions recorded.");
        break;
      }
      console.log(
        pad("SESSION ID", 18) +
          pad("USER", 14) +
          pad("PROJECT", 20) +
          pad("EVENTS", 8) +
          pad("PROMPTS", 8) +
          pad("TOOLS", 8) +
          pad("COST", 10)
      );
      console.log("-".repeat(86));
      for (const s of sessions) {
        console.log(
          pad(s.id.slice(0, 16), 18) +
            pad(s.username || "-", 14) +
            pad(s.project_name || shortPath(s.project_dir), 20) +
            pad(String(s.event_count), 8) +
            pad(String(s.prompt_count), 8) +
            pad(String(s.tool_count), 8) +
            pad(s.total_cost_usd > 0 ? `$${s.total_cost_usd.toFixed(4)}` : "-", 10)
        );
      }
      break;
    }

    case "session": {
      const s = await getSession(pool, args[0]);
      if (!s) {
        console.error(`Session ${args[0]} not found.`);
        process.exit(1);
      }
      console.log(JSON.stringify(s, null, 2));
      break;
    }

    case "events": {
      const events = await getEvents(pool, args[0]);
      if (events.length === 0) {
        console.log("No events found.");
        break;
      }
      for (const e of events) {
        const time = e.timestamp?.slice(11, 19) ?? "";
        const tool = e.tool_name ? ` ${e.tool_name}` : "";
        console.log(`  ${time} | ${e.hook_event_name}${tool}`);
        if (e.summary) console.log(`           ${e.summary}`);
      }
      break;
    }

    case "stats": {
      const statUserIdx = args.indexOf("--user");
      const statUser = statUserIdx >= 0 ? args[statUserIdx + 1] : undefined;
      const stats = await getStats(pool, statUser);
      console.log(`Sessions: ${stats.total_sessions}`);
      console.log(`Events:   ${stats.total_events}`);
      if (stats.total_input_tokens > 0 || stats.total_output_tokens > 0) {
        console.log(`\nToken Usage:`);
        console.log(`  Input:  ${stats.total_input_tokens.toLocaleString()}`);
        console.log(`  Output: ${stats.total_output_tokens.toLocaleString()}`);
        console.log(`  Cost:   $${stats.total_cost_usd.toFixed(4)}`);
      }
      if (stats.tool_usage.length > 0) {
        console.log("\nTool Usage:");
        const max = Math.max(...stats.tool_usage.map((t) => t.count), 1);
        for (const t of stats.tool_usage) {
          const bar = "\u2588".repeat(Math.round((t.count / max) * 30));
          console.log(`  ${pad(t.name, 12)} ${pad(bar, 32)} ${t.count}`);
        }
      }
      break;
    }

    case "share": {
      const share = await createShare(pool, args[0]);
      console.log(`Share created: ${share.id}`);
      console.log(`URL: http://localhost:8111/share/${share.id}`);
      console.log(`Expires: ${share.expires_at}`);
      break;
    }

    case "projects": {
      const projUserIdx = args.indexOf("--user");
      const projUser = projUserIdx >= 0 ? args[projUserIdx + 1] : undefined;
      const projects = await listProjects(pool, projUser);
      if (projects.length === 0) {
        console.log("No projects found.");
        break;
      }
      console.log(
        pad("PROJECT", 24) +
          pad("SESSIONS", 10) +
          pad("EVENTS", 10) +
          pad("PROMPTS", 10) +
          pad("COST", 12) +
          "LAST ACTIVITY"
      );
      console.log("-".repeat(90));
      for (const p of projects) {
        console.log(
          pad(p.project_name, 24) +
            pad(String(p.session_count), 10) +
            pad(String(p.event_count), 10) +
            pad(String(p.prompt_count), 10) +
            pad(p.total_cost_usd > 0 ? `$${p.total_cost_usd.toFixed(4)}` : "-", 12) +
            (p.last_activity?.slice(0, 19) ?? "-")
        );
      }
      break;
    }

    case "costs": {
      const costUserIdx = args.indexOf("--user");
      const costUser = costUserIdx >= 0 ? args[costUserIdx + 1] : undefined;
      const sinceIdx = args.indexOf("--since");
      const since = sinceIdx >= 0 ? args[sinceIdx + 1] : undefined;
      const costs = await getAggregateCosts(pool, { username: costUser, since });
      console.log("Cost Summary:");
      console.log(`  Input tokens:  ${costs.total.input_tokens.toLocaleString()}`);
      console.log(`  Output tokens: ${costs.total.output_tokens.toLocaleString()}`);
      console.log(`  Total tokens:  ${costs.total.total_tokens.toLocaleString()}`);
      console.log(`  Est. cost:     $${costs.total.estimated_cost_usd.toFixed(4)}`);
      if (costs.by_session.length > 0) {
        console.log("\nTop Sessions by Cost:");
        for (const s of costs.by_session.slice(0, 10)) {
          if (s.cost.estimated_cost_usd === 0) continue;
          console.log(`  ${pad(s.session_id.slice(0, 16), 18)} ${pad(s.username, 14)} $${s.cost.estimated_cost_usd.toFixed(4)}`);
        }
      }
      break;
    }

    case "export": {
      const fmtIdx = args.indexOf("--format");
      const fmt = fmtIdx >= 0 ? args[fmtIdx + 1] : "json";
      const expUserIdx = args.indexOf("--user");
      const expUser = expUserIdx >= 0 ? args[expUserIdx + 1] : undefined;
      if (fmt === "csv") {
        console.log(await exportSessionsCsv(pool, { username: expUser }));
      } else {
        console.log(JSON.stringify(await exportSessionsJson(pool, { username: expUser }), null, 2));
      }
      break;
    }

    case "prune": {
      const daysIdx = args.indexOf("--days");
      const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 90;
      const result = await pruneOldData(pool, days);
      console.log(`Pruned: ${result.sessions_deleted} sessions, ${result.events_deleted} events, ${result.shares_deleted} shares`);
      break;
    }

    case "cleanup-shares": {
      const deleted = await cleanupExpiredShares(pool);
      console.log(`Cleaned up ${deleted} expired shares.`);
      break;
    }

    case "create-key": {
      const keyUserIdx = args.indexOf("--user");
      const keyUser = keyUserIdx >= 0 ? args[keyUserIdx + 1] : undefined;
      const roleIdx = args.indexOf("--role");
      const role = (roleIdx >= 0 ? args[roleIdx + 1] : "viewer") as "admin" | "viewer";
      const labelIdx = args.indexOf("--label");
      const label = labelIdx >= 0 ? args[labelIdx + 1] : "";
      if (!keyUser) {
        console.error("--user is required");
        process.exit(1);
      }
      const result = await createApiKey(pool, keyUser, role, label);
      console.log(`API Key created (save this — it won't be shown again):`);
      console.log(`  Key:      ${result.key}`);
      console.log(`  ID:       ${result.id}`);
      console.log(`  User:     ${keyUser}`);
      console.log(`  Role:     ${role}`);
      break;
    }

    case "health": {
      const health = await getHealthStatus(pool);
      console.log(`Status:    ${health.status}`);
      console.log(`Database:  ${health.db}`);
      console.log(`Queue:     ${health.queue.pending} pending, ${health.queue.failed} failed`);
      console.log(`Uptime:    ${health.uptime_seconds}s`);
      break;
    }

    case "process-queue": {
      const result = await processQueue(pool);
      console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
      break;
    }

    case "prompts": {
      const userIdx = args.indexOf("--user");
      const user = userIdx >= 0 ? args[userIdx + 1] : undefined;
      const projIdx = args.indexOf("--project");
      const project = projIdx >= 0 ? args[projIdx + 1] : undefined;
      const searchIdx = args.indexOf("--search");
      const search = searchIdx >= 0 ? args[searchIdx + 1] : undefined;
      const limitIdx = args.indexOf("--limit");
      const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 20;
      const result = await listPrompts(pool, { username: user, project, search, limit });
      if (result.prompts.length === 0) {
        console.log("No prompts found.");
        break;
      }
      console.log(
        pad("TIME", 10) + pad("USER", 14) + pad("PROJECT", 18) +
        pad("DUR", 8) + pad("TOOLS", 7) + pad("COST", 10) + "PROMPT"
      );
      console.log("-".repeat(100));
      for (const p of result.prompts) {
        const dur = p.duration_seconds != null ? `${p.duration_seconds}s` : "-";
        const cost = p.cost_usd > 0 ? `$${p.cost_usd.toFixed(4)}` : "-";
        const text = p.prompt_text.slice(0, 40).replace(/\n/g, " ");
        console.log(
          pad(p.timestamp.slice(11, 19), 10) +
          pad(p.username || "-", 14) +
          pad(p.project_name || "-", 18) +
          pad(dur, 8) +
          pad(String(p.tool_count), 7) +
          pad(cost, 10) +
          text
        );
      }
      console.log(`\n${result.total} total prompts`);
      break;
    }

    case "backfill-projects": {
      const updated = await backfillProjectNames(pool);
      console.log(`Backfilled project names for ${updated} sessions.`);
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}. Run with --help for usage.`);
      process.exit(1);
  }

  await pool.end();
}

function serve(args: string[]) {
  const portIdx = args.indexOf("--port");
  const port = portIdx >= 0 ? args[portIdx + 1] : "8111";

  console.log(BANNER);
  console.log(`  Starting Next.js on port ${port}...`);
  console.log(`  Hook URL: http://localhost:${port}/api/hooks\n`);

  const { execSync } = require("child_process");
  try {
    execSync(`npx next dev -p ${port}`, { stdio: "inherit", cwd: process.cwd() });
  } catch {
    // Ctrl+C
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function shortPath(p: string): string {
  if (!p) return "-";
  return p.replace(/^\/home\/[^/]+/, "~");
}

main();
