import * as fs from "fs";
import * as path from "path";
import { spawn, type ChildProcess } from "child_process";
import * as vscode from "vscode";

const DEFAULT_PORT = 38472;

export interface DevServerOptions {
  port?: number;
  runtimeDirectory: string;
}

export class ViteDevServer {
  private process: ChildProcess | null = null;
  private _port: number;
  private readonly runtimeDirectory: string;

  constructor(options: DevServerOptions) {
    this._port = options.port ?? DEFAULT_PORT;
    this.runtimeDirectory = options.runtimeDirectory;
  }

  get port(): number {
    return this._port;
  }

  getPort(): number {
    return this._port;
  }

  isRunning(): boolean {
    return this.process != null && !this.process.killed;
  }

  start(): Promise<void> {
    if (this.isRunning()) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        GAMEIDE_RUNTIME_PORT: String(this._port),
      };

      const child = spawn("npm", ["run", "dev"], {
        cwd: this.runtimeDirectory,
        env,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.process = child;

      const onExit = (code: number | null, signal: string | null) => {
        this.process = null;
        const suffix = signal ? " (" + signal + ")" : "";
        if (code != null && code !== 0 && code !== 143) {
          reject(new Error("Vite exited with code " + code + suffix));
        }
      };

      child.on("error", (err) => {
        this.process = null;
        reject(err);
      });

      child.on("exit", onExit);

      let resolved = false;
      const done = (err?: Error) => {
        if (resolved) return;
        resolved = true;
        child.off("exit", onExit);
        if (err) reject(err);
        else resolve();
      };

      const stdout = child.stdout;
      const stderr = child.stderr;

      const capturePort = (chunk: string) => {
        const m = chunk.match(/Local:.*http:\/\/[^:]+:(\d+)/);
        if (m) this._port = parseInt(m[1], 10);
      };

      if (stdout) {
        stdout.setEncoding("utf8");
        stdout.on("data", (chunk: string) => {
          if (!resolved && /Local:.*http:/.test(chunk)) {
            capturePort(chunk);
            done();
          }
        });
      }

      if (stderr) {
        stderr.setEncoding("utf8");
        stderr.on("data", (chunk: string) => {
          if (!resolved && /Local:.*http:/.test(chunk)) {
            capturePort(chunk);
            done();
          }
        });
      }

      setTimeout(() => done(), 15000);
    });
  }

  stop(): void {
    if (!this.process) return;
    this.process.kill("SIGTERM");
    this.process = null;
  }

  dispose(): void {
    this.stop();
  }
}

export function resolveRuntimeDir(extensionUri: vscode.Uri): string | undefined {
  const hasPackageJson = (directory: string): boolean => {
    try {
      return fs.existsSync(path.join(directory, "package.json"));
    } catch {
      return false;
    }
  };

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders?.length) {
    for (const folder of workspaceFolders) {
      const templatePath = path.join(folder.uri.fsPath, "cli", "template");
      if (hasPackageJson(templatePath)) {
        return templatePath;
      }
    }
  }

  const repositoryRoot = path.dirname(extensionUri.fsPath);
  const templateSibling = path.join(repositoryRoot, "cli", "template");
  if (hasPackageJson(templateSibling)) {
    return templateSibling;
  }

  return undefined;
}
