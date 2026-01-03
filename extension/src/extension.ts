import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';

let viteProcess: any = null;
let webviewPanel: vscode.WebviewPanel | null = null;

export function activate(context: vscode.ExtensionContext) {
    function startViteServer() {
        if (viteProcess) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            const runtimePath = path.join(__dirname, '..', '..', 'runtime');
            
            viteProcess = spawn('npm', ['run', 'dev'], {
                cwd: runtimePath,
                stdio: 'pipe',
                shell: true
            });

            viteProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                if (output.includes('Local:') && output.includes('5173')) {
                    resolve();
                }
            });

            viteProcess.on('close', () => {
                viteProcess = null;
            });
        });
    }

    async function showWebView() {
        if (webviewPanel) {
            webviewPanel.reveal();
            return;
        }

        await startViteServer();
        
        webviewPanel = vscode.window.createWebviewPanel(
            'webViewContent',
            'NatStack Runtime',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        const htmlPath = path.join(context.extensionPath, 'index.html');
        const html = require('fs').readFileSync(htmlPath, 'utf8');
        webviewPanel.webview.html = html;

        webviewPanel.onDidDispose(() => {
            webviewPanel = null;
        });
    }

    vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'scene' || document.fileName.endsWith('.scene')) {
            showWebView();
        }
    });

    vscode.workspace.textDocuments.forEach((document) => {
        if (document.languageId === 'scene' || document.fileName.endsWith('.scene')) {
            showWebView();
        }
    });
}

export function deactivate() {
    if (viteProcess) {
        viteProcess.kill();
        viteProcess = null;
    }
    if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
    }
}