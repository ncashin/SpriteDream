import * as path from "node:path";
import * as vscode from "vscode";
import { createGameIDEProject } from "gameide-cli";

async function createProject(): Promise<void> {
  const projectName = await vscode.window.showInputBox({
    title: "Create GameIDE Project",
    prompt: "Project folder name",
    placeHolder: "my-gameide-game",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) return "Project name is required";
      if (value.includes("/") || value.includes("\\")) {
        return "Use a folder name, not a path";
      }
      return undefined;
    },
  });
  if (projectName === undefined) return;

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
      title: "Creating GameIDE project",
      cancellable: false,
    },
    () =>
      createGameIDEProject({
        cwd: parentDirectory,
        directory: projectName.trim(),
        name: projectName.trim(),
      }),
  );

  const relativePath = path.relative(parentDirectory, result.directory);
  const open = await vscode.window.showInformationMessage(
    `Created ${result.name} in ${relativePath || result.directory}.`,
    "Open Project",
  );
  if (open === "Open Project") {
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(result.directory),
      false,
    );
  }
}

export function registerCreateProjectCommand(
  context: vscode.ExtensionContext,
): void {
  const disposable = vscode.commands.registerCommand(
    "gameide.createProject",
    () => createProject(),
  );
  context.subscriptions.push(disposable);
}
