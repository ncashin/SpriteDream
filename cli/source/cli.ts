#!/usr/bin/env node
import path from "node:path";
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

function stringFlag(
  flags: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function printHelp(): void {
  console.log(`gameide

Usage:
  gameide create [directory] [--name my-game]
  gameide upload [project-directory] [--base-url URL] [--name my-game] [--description "..."] [--version 0.1.0]

Commands:
  create   Scaffold a new GameIDE game
  upload   Build and upload a GameIDE game
`);
}

async function main(): Promise<void> {
  const [command = "create", ...rest] = process.argv.slice(2);
  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  const { flags, positional } = parseFlags(rest);
  if (command === "create" || command === "init") {
    const directory = positional[0] ?? stringFlag(flags, "name") ?? "my-gameide-game";
    const result = await createGameIDEProject({
      cwd: process.cwd(),
      directory,
      name: stringFlag(flags, "name") ?? path.basename(directory),
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
    const result = await uploadGame({
      projectRoot: positional[0] ?? process.cwd(),
      baseUrl: stringFlag(flags, "baseUrl") ?? PRODUCTION_UPLOAD_BASE_URL,
      buildCommand: stringFlag(flags, "buildCommand"),
      distDirectory: stringFlag(flags, "dist"),
      skipBuild: Boolean(flags.skipBuild),
      manifestFields: {
        name: stringFlag(flags, "name"),
        description: stringFlag(flags, "description"),
        version: stringFlag(flags, "version"),
      },
      onProgress: (message) => console.log(message),
    });
    console.log(
      `Uploaded ${result.uploadedFiles} files to game ${result.gameId} (${result.baseUrl}).`,
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
