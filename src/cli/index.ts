#!/usr/bin/env tsx
/**
 * CLI for claude-logger - exercises the same lib as the web app.
 *
 * Usage:
 *   npx tsx src/cli/index.ts sessions
 *   npx tsx src/cli/index.ts session <id>
 *   npx tsx src/cli/index.ts events <session-id>
 *   npx tsx src/cli/index.ts stats
 *   npx tsx src/cli/index.ts share <session-id>
 *   npx tsx src/cli/index.ts serve [--port 8111]
 */

import { openDb } from "../lib/db";
import { getEvents } from "../lib/events";
import { listUsers, listSessions, getSession, getStats } from "../lib/sessions";
import { createShare } from "../lib/shares";

const BANNER = `
 ╔═╗╦  ╔═╗╦ ╦╔╦╗╔═╗  ╦  ╔═╗╔═╗╔═╗╔═╗╦═╗
 ║  ║  ╠═╣║ ║ ║║║╣   ║  ║ ║║ ╦║ ╦║╣ ╠╦╝
 ╚═╝╩═╝╩ ╩╚═╝═╩╝╚═╝  ╩═╝╚═╝╚═╝╚═╝╚═╝╩╚═
           v0.1.0 :: cli
`;

function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(BANNER);
    console.log("Commands:");
    console.log("  users                 List all users");
    console.log("  sessions [--user X]   List all sessions");
    console.log("  session <id>          Show session detail");
    console.log("  events <session-id>   Show events for a session");
    console.log("  stats [--user X]      Show aggregate stats");
    console.log("  share <session-id>    Create a share link");
    console.log("  serve [--port N]      Start the web server");
    process.exit(0);
  }

  if (cmd === "serve") {
    serve(args);
    return;
  }

  const db = openDb();

  switch (cmd) {
    case "users": {
      const users = listUsers(db);
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
      const sessions = listSessions(db, 50, 0, user);
      if (sessions.length === 0) {
        console.log("No sessions recorded.");
        break;
      }
      console.log(
        pad("SESSION ID", 18) +
          pad("USER", 14) +
          pad("PROJECT", 26) +
          pad("EVENTS", 8) +
          pad("PROMPTS", 8) +
          pad("TOOLS", 8)
      );
      console.log("-".repeat(82));
      for (const s of sessions) {
        console.log(
          pad(s.id.slice(0, 16), 18) +
            pad(s.username || "-", 14) +
            pad(shortPath(s.project_dir), 26) +
            pad(String(s.event_count), 8) +
            pad(String(s.prompt_count), 8) +
            pad(String(s.tool_count), 8)
        );
      }
      break;
    }

    case "session": {
      const s = getSession(db, args[0]);
      if (!s) {
        console.error(`Session ${args[0]} not found.`);
        process.exit(1);
      }
      console.log(JSON.stringify(s, null, 2));
      break;
    }

    case "events": {
      const events = getEvents(db, args[0]);
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
      const stats = getStats(db, statUser);
      console.log(`Sessions: ${stats.total_sessions}`);
      console.log(`Events:   ${stats.total_events}`);
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
      const share = createShare(db, args[0]);
      console.log(`Share created: ${share.id}`);
      console.log(`URL: http://localhost:8111/share/${share.id}`);
      console.log(`Expires: ${share.expires_at}`);
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}. Run with --help for usage.`);
      process.exit(1);
  }

  db.close();
}

function serve(args: string[]) {
  const portIdx = args.indexOf("--port");
  const port = portIdx >= 0 ? args[portIdx + 1] : "8111";

  console.log(BANNER);
  console.log(`  Starting Next.js on port ${port}...`);
  console.log(`  Hook URL: http://localhost:${port}/api/hooks\n`);

  // Use execSync to start next dev
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
