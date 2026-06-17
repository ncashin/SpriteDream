#!/usr/bin/env node
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  PRODUCTION_UPLOAD_BASE_URL,
  createGameIDEProject,
  uploadGame,
} from "./index";

type ParsedFlags = {
  flags: Record<string, string | boolean>;
  positional: string[];
};

function parseFlags(args: string[]): ParsedFlags {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char: string) =>
      char.toUpperCase(),
    );
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }

    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positional };
}

async function promptProjectName(): Promise<string> {
  if (!input.isTTY) {
    throw new Error(
      "gameide create requires an interactive terminal to prompt for a project name.",
    );
  }

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const answer = (await rl.question("Project name: ")).trim();
      if (answer) return answer;
      console.log("Project name is required.");
    }
  } finally {
    rl.close();
  }
}

function printHelp(): void {
  console.log(`gameide

Usage:
  gameide create [directory]   Default directory: ./{project-name}
  gameide upload [directory]   Default directory: .
      --url <base-url>         GameIDE server URL (default: https://gameide.app)

Commands:
  create   Scaffold a new GameIDE game
  upload   Build and upload a GameIDE game
`);
}

function parseUploadBaseURL(flags: Record<string, string | boolean>): string {
  const unknownFlags = Object.keys(flags).filter((key) => key !== "url");
  if (unknownFlags.length > 0) {
    throw new Error(
      `Unknown flag(s): ${unknownFlags.map((flag) => `--${flag}`).join(", ")}`,
    );
  }

  const urlFlag = flags.url;
  if (urlFlag === undefined) {
    return PRODUCTION_UPLOAD_BASE_URL;
  }
  if (typeof urlFlag !== "string") {
    throw new Error("--url requires a value.");
  }

  try {
    new URL(urlFlag);
    return urlFlag;
  } catch {
    throw new Error(`Invalid --url value: ${urlFlag}`);
  }
}

async function main(): Promise<void> {
  const [command = "create", ...rest] = process.argv.slice(2);
  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  const { flags, positional } = parseFlags(rest);
  if (command === "create" || command === "init") {
    if (Object.keys(flags).length > 0) {
      throw new Error("gameide create does not accept flags.");
    }

    const name = await promptProjectName();
    const result = await createGameIDEProject({
      cwd: process.cwd(),
      ...(positional[0] ? { directory: positional[0] } : {}),
      name,
    });
    console.log(`Created ${result.name} in ${result.directory}`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${path.relative(process.cwd(), result.directory) || "."}`);
    console.log("  npm install");
    console.log("  npm run dev");
    return;
  }

  if (command === "upload" || command === "deploy") {
    const baseURL = parseUploadBaseURL(flags);

    const result = await uploadGame({
      projectRoot: path.resolve(process.cwd(), positional[0] ?? "."),
      baseURL,
      onProgress: (message) => console.log(message),
    });
    console.log(
      `Uploaded ${result.uploadedFiles} files to game ${result.gameId} (${result.baseURL}).`,
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
