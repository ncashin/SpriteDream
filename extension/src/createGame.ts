import * as path from "node:path";
import * as vscode from "vscode";
import { createGameIDEProject } from "gameide-cli";

async function createGame(): Promise<void> {
  const gameName = await vscode.window.showInputBox({
    title: "Create GameIDE Game",
    prompt: "Game folder name",
    placeHolder: "my-gameide-game",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) return "Game name is required";
      if (value.includes("/") || value.includes("\\")) {
        return "Use a folder name, not a path";
      }
      return undefined;
    },
  });
  if (gameName === undefined) return;

  const parent = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: "Create Here",
    title: "Choose parent folder",
  });
  const parentDirectory = parent?.[0]?.fsPath;
  if (!parentDirectory) return;

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Creating GameIDE game",
      cancellable: false,
    },
    () =>
      createGameIDEProject({
        cwd: parentDirectory,
        directory: gameName.trim(),
        name: gameName.trim(),
      }),
  );

  const relativePath = path.relative(parentDirectory, result.directory);
  const open = await vscode.window.showInformationMessage(
    `Created ${result.name} in ${relativePath || result.directory}.`,
    "Open Game",
  );
  if (open === "Open Game") {
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(result.directory),
      false,
    );
  }
}

export function registerCreateGameCommand(
  context: vscode.ExtensionContext,
): void {
  const disposable = vscode.commands.registerCommand(
    "gameide.createGame",
    () => createGame(),
  );
  context.subscriptions.push(disposable);
}
