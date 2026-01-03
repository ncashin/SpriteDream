import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "natstack" is now active!');

    let disposable = vscode.commands.registerCommand('natstack.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from VS Code Extension!');
    });

    let webviewCommand = vscode.commands.registerCommand('natstack.showWebView', () => {
        const panel = vscode.window.createWebviewPanel(
            'webViewContent',
            'WebView Content',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const htmlPath = path.join(context.extensionPath, 'index.html');
        const html = require('fs').readFileSync(htmlPath, 'utf8');
        panel.webview.html = html;

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'buttonClicked':
                        vscode.window.showInformationMessage('Received message from webview: ' + message.text);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(webviewCommand);
}

export function deactivate() {}