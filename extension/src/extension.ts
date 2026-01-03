import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "hello-world-extension" is now active!');

    let disposable = vscode.commands.registerCommand('hello-world.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from VS Code Extension!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}