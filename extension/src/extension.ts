import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';

let viteProcess: any = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "natstack" is now active!');

    let disposable = vscode.commands.registerCommand('natstack.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from VS Code Extension!');
    });

    function startViteServer() {
        if (viteProcess) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            const runtimePath = path.join(__dirname, '..', '..', 'runtime');
            
            viteProcess = spawn('npm', ['run', 'dev'], {
                cwd: runtimePath,
                stdio: 'pipe',
                shell: true
            });

            let serverReady = false;

            viteProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                console.log(`Vite: ${output}`);
                
                if (output.includes('Local:') && output.includes('5173') && !serverReady) {
                    serverReady = true;
                    resolve();
                }
            });

            viteProcess.stderr.on('data', (data: Buffer) => {
                console.error(`Vite error: ${data}`);
            });

            viteProcess.on('close', (code: number | null) => {
                console.log(`Vite process exited with code ${code}`);
                viteProcess = null;
            });

            viteProcess.on('error', (error: Error) => {
                console.error(`Failed to start Vite: ${error}`);
                reject(error);
            });

            // Fallback timeout
            setTimeout(() => {
                if (!serverReady) {
                    console.log('Vite server timeout, assuming it started');
                    serverReady = true;
                    resolve();
                }
            }, 5000);
        });
    }

    let webviewCommand = vscode.commands.registerCommand('natstack.showWebView', async () => {
        try {
            // Start Vite server first
            await startViteServer();
            
            const panel = vscode.window.createWebviewPanel(
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
            panel.webview.html = html;

panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'buttonClicked':
                        vscode.window.showInformationMessage('Received message from webview: ' + message.text);
                        break;
                    case 'restartVite':
                        if (viteProcess) {
                            viteProcess.kill();
                            viteProcess = null;
                        }
                        startViteServer().then(() => {
                            panel.webview.postMessage({ command: 'viteRestarted' });
                        });
                        break;
                    case 'openInBrowser':
                        vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173'));
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

            panel.onDidDispose(() => {
                // Keep Vite running even when webview is closed
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start Vite server: ${error}`);
        }
    });

    let stopViteCommand = vscode.commands.registerCommand('natstack.stopVite', () => {
        if (viteProcess) {
            viteProcess.kill();
            viteProcess = null;
            vscode.window.showInformationMessage('Vite dev server stopped');
        } else {
            vscode.window.showInformationMessage('Vite dev server is not running');
        }
    });

    let restartViteCommand = vscode.commands.registerCommand('natstack.restartVite', async () => {
        if (viteProcess) {
            viteProcess.kill();
            viteProcess = null;
        }
        await startViteServer();
        vscode.window.showInformationMessage('Vite dev server restarted');
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(webviewCommand);
    context.subscriptions.push(stopViteCommand);
    context.subscriptions.push(restartViteCommand);
}

export function deactivate() {
    if (viteProcess) {
        viteProcess.kill();
        viteProcess = null;
    }
}