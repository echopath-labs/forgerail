#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const scenario = process.env.FORGERAIL_CURSOR_FAKE_SCENARIO ?? "success-read-only";
const sessionId = process.env.FORGERAIL_CURSOR_FAKE_SESSION_ID ?? "cursor-fake-session-1";

if (args.includes("--version") || args.includes("-v")) {
  console.log("cursor-agent 9.9.9-fake");
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: cursor-agent [options] [prompt]\n  -p, --print\n  --output-format <text|json|stream-json>\n  --resume=<chatId>\n  -f, --force\n  status");
  process.exit(0);
}

if (args[0] === "status" || (args[0] === "auth" && args[1] === "status")) {
  if (scenario === "unauthenticated") {
    console.error("Not logged in");
    process.exit(1);
  }
  console.log("Logged in");
  process.exit(0);
}

if (scenario === "nonzero") {
  console.error("synthetic Cursor failure");
  process.exit(7);
}

if (scenario === "timeout") {
  setTimeout(() => process.exit(0), 30_000);
} else if (scenario === "malformed") {
  process.stdout.write("{not-json}\n");
} else {
  const resumed = args.some((value) => value === "--resume" || value.startsWith("--resume="));
  if (scenario === "success-write") writeFileSync(resolve(process.cwd(), "src/value.txt"), "updated\n");
  if (scenario === "out-of-scope") writeFileSync(resolve(process.cwd(), "outside.txt"), "unexpected\n");
  console.log(JSON.stringify({
    type: "system",
    subtype: "init",
    cwd: process.cwd(),
    session_id: sessionId,
    model: "Fake Cursor",
    permissionMode: args.includes("--force") ? "force" : "default"
  }));
  console.log(JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: resumed ? "resumed" : "completed" }] },
    session_id: sessionId
  }));
  if (scenario !== "missing-terminal") {
    console.log(JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      duration_ms: 1,
      duration_api_ms: 1,
      result: resumed ? "resumed" : "completed",
      session_id: sessionId
    }));
  }
}
