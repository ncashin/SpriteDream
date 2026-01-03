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

    async function showWebView(document?: vscode.TextDocument) {
        if (webviewPanel) {
            webviewPanel.reveal();
            if (document) {
                webviewPanel.webview.postMessage({
                    command: 'openScene',
                    path: document.fileName
                });
            }
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
        
        const activeEditor = vscode.window.activeTextEditor;
        const sceneDocument = document || (activeEditor && 
            (activeEditor.document.languageId === 'scene' || activeEditor.document.fileName.endsWith('.scene')) 
            ? activeEditor.document 
            : null);
        
        if (sceneDocument) {
            setTimeout(() => {
                webviewPanel?.webview.postMessage({
                    command: 'openScene',
                    path: sceneDocument.fileName
                });
            }, 1000);
        }

        // Handle messages from the webview (which forwards messages from the iframe)
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'readFile':
                    try {
                        const uri = vscode.Uri.file(message.path);
                        const document = await vscode.workspace.openTextDocument(uri);
                        const content = document.getText();
                        webviewPanel?.webview.postMessage({
                            command: 'readFileResponse',
                            requestId: message.requestId,
                            success: true,
                            content: content
                        });
                    } catch (error: any) {
                        webviewPanel?.webview.postMessage({
                            command: 'readFileResponse',
                            requestId: message.requestId,
                            success: false,
                            error: error.message
                        });
                    }
                    break;

                case 'writeFile':
                    try {
                        const uri = vscode.Uri.file(message.path);
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(uri, new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), message.content);
                        await vscode.workspace.applyEdit(edit);
                        webviewPanel?.webview.postMessage({
                            command: 'writeFileResponse',
                            requestId: message.requestId,
                            success: true
                        });
                    } catch (error: any) {
                        webviewPanel?.webview.postMessage({
                            command: 'writeFileResponse',
                            requestId: message.requestId,
                            success: false,
                            error: error.message
                        });
                    }
                    break;

                case 'listFiles':
                    try {
                        const uri = vscode.Uri.file(message.path);
                        const files = await vscode.workspace.fs.readDirectory(uri);
                        webviewPanel?.webview.postMessage({
                            command: 'listFilesResponse',
                            requestId: message.requestId,
                            success: true,
                            files: files
                        });
                    } catch (error: any) {
                        webviewPanel?.webview.postMessage({
                            command: 'listFilesResponse',
                            requestId: message.requestId,
                            success: false,
                            error: error.message
                        });
                    }
                    break;

                case 'getWorkspaceRoot':
                    try {
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (workspaceFolders && workspaceFolders.length > 0) {
                            webviewPanel?.webview.postMessage({
                                command: 'getWorkspaceRootResponse',
                                requestId: message.requestId,
                                success: true,
                                root: workspaceFolders[0].uri.fsPath
                            });
                        } else {
                            webviewPanel?.webview.postMessage({
                                command: 'getWorkspaceRootResponse',
                                requestId: message.requestId,
                                success: false,
                                error: 'No workspace folder open'
                            });
                        }
                    } catch (error: any) {
                        webviewPanel?.webview.postMessage({
                            command: 'getWorkspaceRootResponse',
                            requestId: message.requestId,
                            success: false,
                            error: error.message
                        });
                    }
                    break;
            }
        });

        webviewPanel.onDidDispose(() => {
            webviewPanel = null;
        });
    }

    vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'scene' || document.fileName.endsWith('.scene')) {
            showWebView(document);
        }
    });

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && (editor.document.languageId === 'scene' || editor.document.fileName.endsWith('.scene'))) {
            if (webviewPanel) {
                webviewPanel.webview.postMessage({
                    command: 'openScene',
                    path: editor.document.fileName
                });
            }
        }
    });

    vscode.workspace.textDocuments.forEach((document) => {
        if (document.languageId === 'scene' || document.fileName.endsWith('.scene')) {
            showWebView(document);
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
