import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

let viteProcess: any = null;

class SceneEditorProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'natstack.sceneEditor';

    constructor(private context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new SceneEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
            SceneEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        await this.startViteServer();

        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: []
        };

        const htmlPath = path.join(this.context.extensionPath, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        webviewPanel.webview.html = html;

        // Track if we're updating from webview to prevent feedback loop
        let isUpdatingFromWebview = false;

        // Send initial document content
        this.updateWebview(document, webviewPanel);

        // Handle document changes from outside the editor
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && !isUpdatingFromWebview) {
                this.updateWebview(document, webviewPanel);
            }
        });

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            // Handle file operation requests
            if (message.type && message.requestId) {
                const requestId = message.requestId;
                
                try {
                    switch (message.type) {
                        case 'readFile': {
                            const uri = vscode.Uri.file(message.path);
                            const doc = await vscode.workspace.openTextDocument(uri);
                            const content = doc.getText();
                            webviewPanel.webview.postMessage({
                                type: 'readFile',
                                requestId,
                                success: true,
                                content
                            });
                            break;
                        }

                        case 'writeFile': {
                            const uri = vscode.Uri.file(message.path);
                            // Prevent feedback loop if updating current document
                            if (uri.toString() === document.uri.toString()) {
                                isUpdatingFromWebview = true;
                            }
                            const edit = new vscode.WorkspaceEdit();
                            edit.replace(uri, new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), message.content);
                            await vscode.workspace.applyEdit(edit);
                            setTimeout(() => { isUpdatingFromWebview = false; }, 100);
                            webviewPanel.webview.postMessage({
                                type: 'writeFile',
                                requestId,
                                success: true
                            });
                            break;
                        }

                        case 'listFiles': {
                            const uri = vscode.Uri.file(message.path);
                            const files = await vscode.workspace.fs.readDirectory(uri);
                            webviewPanel.webview.postMessage({
                                type: 'listFiles',
                                requestId,
                                success: true,
                                files
                            });
                            break;
                        }

                        case 'getWorkspaceRoot': {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (workspaceFolders && workspaceFolders.length > 0) {
                                webviewPanel.webview.postMessage({
                                    type: 'getWorkspaceRoot',
                                    requestId,
                                    success: true,
                                    root: workspaceFolders[0].uri.fsPath
                                });
                            } else {
                                webviewPanel.webview.postMessage({
                                    type: 'getWorkspaceRoot',
                                    requestId,
                                    success: false,
                                    error: 'No workspace folder open'
                                });
                            }
                            break;
                        }
                    }
                } catch (error: any) {
                    webviewPanel.webview.postMessage({
                        type: message.type,
                        requestId,
                        success: false,
                        error: error.message
                    });
                    if (message.type === 'writeFile') {
                        isUpdatingFromWebview = false;
                    }
                }
            }
        });

        // Clean up
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    private updateWebview(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        // Send the document content to the webview
        setTimeout(() => {
            webviewPanel.webview.postMessage({
                command: 'openScene',
                path: document.fileName,
                content: document.getText()
            });
        }, 500);
    }

    private async startViteServer(): Promise<void> {
        if (viteProcess) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            const runtimePath = path.join(this.context.extensionPath, '..', 'runtime');
            const viteBin = process.platform === 'win32' 
                ? path.join(runtimePath, 'node_modules', '.bin', 'vite.cmd')
                : path.join(runtimePath, 'node_modules', '.bin', 'vite');
            
            viteProcess = spawn(viteBin, [], {
                cwd: runtimePath,
                stdio: 'pipe',
                shell: false,
                env: { ...process.env }
            });

            viteProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                if (output.includes('Local:') && output.includes('7777')) {
                    resolve();
                }
            });

            viteProcess.stderr.on('data', (data: Buffer) => {
                const output = data.toString();
                if (output.includes('Local:') && output.includes('7777')) {
                    resolve();
                }
            });

            viteProcess.on('close', () => {
                viteProcess = null;
            });

            viteProcess.on('error', (error: Error) => {
                console.error('Failed to start Vite:', error);
                viteProcess = null;
            });
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(SceneEditorProvider.register(context));
}

export function deactivate() {
    if (viteProcess) {
        viteProcess.kill();
        viteProcess = null;
    }
}
