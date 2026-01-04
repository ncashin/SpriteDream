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
            switch (message.command) {
                case 'readFile':
                    try {
                        const uri = vscode.Uri.file(message.path);
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const content = doc.getText();
                        webviewPanel.webview.postMessage({
                            command: 'readFileResponse',
                            requestId: message.requestId,
                            success: true,
                            content: content
                        });
                    } catch (error: any) {
                        webviewPanel.webview.postMessage({
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
                        // If updating the current document, set flag to prevent feedback loop
                        if (uri.toString() === document.uri.toString()) {
                            isUpdatingFromWebview = true;
                        }
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(uri, new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), message.content);
                        await vscode.workspace.applyEdit(edit);
                        // Reset flag after a short delay
                        setTimeout(() => {
                            isUpdatingFromWebview = false;
                        }, 100);
                        webviewPanel.webview.postMessage({
                            command: 'writeFileResponse',
                            requestId: message.requestId,
                            success: true
                        });
                    } catch (error: any) {
                        isUpdatingFromWebview = false;
                        webviewPanel.webview.postMessage({
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
                        webviewPanel.webview.postMessage({
                            command: 'listFilesResponse',
                            requestId: message.requestId,
                            success: true,
                            files: files
                        });
                    } catch (error: any) {
                        webviewPanel.webview.postMessage({
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
                            webviewPanel.webview.postMessage({
                                command: 'getWorkspaceRootResponse',
                                requestId: message.requestId,
                                success: true,
                                root: workspaceFolders[0].uri.fsPath
                            });
                        } else {
                            webviewPanel.webview.postMessage({
                                command: 'getWorkspaceRootResponse',
                                requestId: message.requestId,
                                success: false,
                                error: 'No workspace folder open'
                            });
                        }
                    } catch (error: any) {
                        webviewPanel.webview.postMessage({
                            command: 'getWorkspaceRootResponse',
                            requestId: message.requestId,
                            success: false,
                            error: error.message
                        });
                    }
                    break;
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
            
            viteProcess = spawn('npm', ['run', 'dev'], {
                cwd: runtimePath,
                stdio: 'pipe',
                shell: true
            });

            viteProcess.stdout.on('data', (data: Buffer) => {
                const output = data.toString();
                if (output.includes('Local:') && output.includes('7777')) {
                    resolve();
                }
            });

            viteProcess.on('close', () => {
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
