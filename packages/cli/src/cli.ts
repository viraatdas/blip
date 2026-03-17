#!/usr/bin/env node

import { init } from "./commands/init.js";
import { login } from "./commands/login.js";
import { push } from "./commands/push.js";
import { status } from "./commands/status.js";
import { run } from "./commands/run.js";

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function printHelp() {
  console.log(`
blip - CLI for Blip serverless Claude Code agents

Usage:
  blip <command> [options]

Commands:
  init                Scaffold a .blip/ directory with template files
  login               Authenticate with the Blip API
  push                Deploy agent configuration to Blip
  status              Check agent template build status
  run <prompt>        Execute a prompt against your agent

Options:
  --help              Show this help message

Examples:
  blip init
  blip login --api-key blip_xxx_yyy
  blip push
  blip status --watch
  blip run "list files in /home/user"
`.trim());
}

async function main() {
  const { positional, flags } = parseFlags(process.argv.slice(2));
  const command = positional[0];

  if (flags.help || !command) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "init":
        await init(flags);
        break;
      case "login":
        await login(flags);
        break;
      case "push":
        await push(flags);
        break;
      case "status":
        await status(flags);
        break;
      case "run":
        await run(positional.slice(1).join(" "), flags);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
