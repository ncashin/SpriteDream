import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { exportToTauri } from './export';

let viteProcess: any = null;
let viteServerReady: Promise<void> | null = null;

async function startViteServer(context: vscode.ExtensionContext): Promise<void> {
    if (viteProcess) {
        return viteServerReady || Promise.resolve();
    }

    if (viteServerReady) {
        return viteServerReady;
    }

    viteServerReady = new Promise<void>((resolve, reject) => {
        const runtimePath = path.join(context.extensionPath, '..', 'runtime');
        const viteBin = process.platform === 'win32' 
            ? path.join(runtimePath, 'node_modules', '.bin', 'vite.cmd')
            : path.join(runtimePath, 'node_modules', '.bin', 'vite');
        
        viteProcess = spawn(viteBin, [], {
            cwd: runtimePath,
            stdio: 'pipe',
            shell: false,
            env: { ...process.env }
        });

        let resolved = false;

        viteProcess.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            if (output.includes('Local:') && output.includes('7777') && !resolved) {
                resolved = true;
                resolve();
            }
        });

        viteProcess.stderr.on('data', (data: Buffer) => {
            const output = data.toString();
            if (output.includes('Local:') && output.includes('7777') && !resolved) {
                resolved = true;
                resolve();
            }
        });

        viteProcess.on('close', (code: number) => {
            viteProcess = null;
            viteServerReady = null;
            if (!resolved && code !== 0) {
                reject(new Error(`Vite server exited with code ${code}`));
            }
        });

        viteProcess.on('error', (error: Error) => {
            console.error('Failed to start Vite:', error);
            viteProcess = null;
            viteServerReady = null;
            if (!resolved) {
                resolved = true;
                reject(error);
            }
        });

        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                reject(new Error('Vite server startup timeout'));
            }
        }, 30000);
    });

    return viteServerReady;
}

class SceneDocument implements vscode.CustomDocument {
    private readonly _uri: vscode.Uri;
    private _documentData: string;
    private _edits: Array<{ content: string }> = [];
    private _savedEdits: Array<{ content: string }> = [];

    private readonly _onDidDispose = new vscode.EventEmitter<void>();
    public readonly onDidDispose = this._onDidDispose.event;

    private readonly _onDidChangeDocument = new vscode.EventEmitter<{
        readonly content?: string;
    }>();
    public readonly onDidChangeContent = this._onDidChangeDocument.event;

    private readonly _onDidChange = new vscode.EventEmitter<{
        readonly label: string,
        undo(): void,
        redo(): void,
    }>();
    public readonly onDidChange = this._onDidChange.event;

    static async create(
        uri: vscode.Uri,
        backupId: string | undefined,
    ): Promise<SceneDocument | PromiseLike<SceneDocument>> {
        const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
        const fileData = await SceneDocument.readFile(dataFile);
        return new SceneDocument(uri, fileData);
    }

    private static async readFile(uri: vscode.Uri): Promise<string> {
        if (uri.scheme === 'untitled') {
            return '';
        }
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf8');
    }

    private constructor(
        uri: vscode.Uri,
        initialContent: string
    ) {
        this._uri = uri;
        this._documentData = initialContent;
    }

    public get uri() { return this._uri; }
    public get documentData(): string { return this._documentData; }

    dispose(): void {
        this._onDidDispose.fire();
    }

    makeEdit(edit: { content: string }) {
        this._edits.push(edit);
        this._documentData = edit.content;

        this._onDidChange.fire({
            label: 'Edit',
            undo: async () => {
                this._edits.pop();
                if (this._edits.length > 0) {
                    this._documentData = this._edits[this._edits.length - 1].content;
                } else {
                    this._documentData = this._savedEdits.length > 0 
                        ? this._savedEdits[this._savedEdits.length - 1].content 
                        : '';
                }
                this._onDidChangeDocument.fire({
                    content: this._documentData,
                });
            },
            redo: async () => {
                this._edits.push(edit);
                this._documentData = edit.content;
                this._onDidChangeDocument.fire({
                    content: this._documentData,
                });
            }
        });
    }

    async save(cancellation: vscode.CancellationToken): Promise<void> {
        await this.saveAs(this.uri, cancellation);
        this._savedEdits = Array.from(this._edits);
    }

    async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
        if (cancellation.isCancellationRequested) {
            return;
        }
        
        // Validate content before saving
        if (!this._documentData || !this._documentData.trim()) {
            throw new Error('Cannot save empty scene data');
        }

        // Validate JSON structure
        try {
            const parsed = JSON.parse(this._documentData);
            // Prevent saving empty objects
            if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length === 0) {
                throw new Error('Cannot save empty scene data');
            }
        } catch (e) {
            if (e instanceof Error && e.message.includes('Cannot save')) {
                throw e;
            }
            throw new Error('Invalid JSON content in scene file');
        }

        const data = Buffer.from(this._documentData, 'utf8');
        await vscode.workspace.fs.writeFile(targetResource, data);
    }

    async revert(_cancellation: vscode.CancellationToken): Promise<void> {
        const diskContent = await SceneDocument.readFile(this.uri);
        this._documentData = diskContent;
        this._edits = this._savedEdits;
        this._onDidChangeDocument.fire({
            content: diskContent,
        });
    }

    async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        await this.saveAs(destination, cancellation);

        return {
            id: destination.toString(),
            delete: async () => {
                try {
                    await vscode.workspace.fs.delete(destination);
                } catch {
                }
            }
        };
    }
}

class SceneEditorProvider implements vscode.CustomEditorProvider<SceneDocument> {
    private static readonly viewType = 'natstack.sceneEditor';
    private readonly webviews: Record<string, vscode.WebviewPanel[]> = {};
    private readonly fileWatchers: Record<string, vscode.FileSystemWatcher> = {};
    private readonly lastKnownSceneState: Record<string, any> = {};
    private readonly isUpdatingFromWebview: Record<string, boolean> = {};

    constructor(private context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new SceneEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
            SceneEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: false,
                },
                supportsMultipleEditorsPerDocument: true,
            }
        );
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken
    ): Promise<SceneDocument> {
        const document = await SceneDocument.create(uri, openContext.backupId);
        const uriString = document.uri.toString();

        try {
            const initialContent = document.documentData;
            if (initialContent) {
                this.lastKnownSceneState[uriString] = JSON.parse(initialContent);
            }
        } catch (e) {
        }

        const watcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);

        watcher.onDidChange(async (changedUri) => {
            if (changedUri.toString() === uriString && 
                !this.isUpdatingFromWebview[uriString]) {
                await this.handleExternalFileChange(document, changedUri);
            }
        });

        this.fileWatchers[uriString] = watcher;

        const listeners: vscode.Disposable[] = [];

        listeners.push(document.onDidChange(e => {
            this._onDidChangeCustomDocument.fire({
                document,
                ...e,
            });
        }));

        listeners.push(document.onDidChangeContent(e => {
            try {
                const content = e.content !== undefined ? e.content : document.documentData;
                if (content) {
                    this.lastKnownSceneState[uriString] = JSON.parse(content);
                }
            } catch (e) {
            }

            const webviewsForDocument = this.webviews[document.uri.toString()] || [];
            for (const webviewPanel of webviewsForDocument) {
                this.postMessage(webviewPanel, 'openScene', {
                    path: document.uri.fsPath,
                    content: e.content !== undefined ? e.content : document.documentData
                });
            }
        }));

        document.onDidDispose(() => {
            listeners.forEach(l => l.dispose());
            const watcher = this.fileWatchers[uriString];
            if (watcher) {
                watcher.dispose();
                delete this.fileWatchers[uriString];
            }
            delete this.lastKnownSceneState[uriString];
            delete this.isUpdatingFromWebview[uriString];
        });

        return document;
    }

    async resolveCustomEditor(
        document: SceneDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        await startViteServer(this.context).catch(err => {
            console.error('Vite server not available:', err);
        });

        const uriString = document.uri.toString();
        if (!this.webviews[uriString]) {
            this.webviews[uriString] = [];
        }
        this.webviews[uriString].push(webviewPanel);

        webviewPanel.onDidDispose(() => {
            const webviewsForUri = this.webviews[uriString];
            if (webviewsForUri) {
                const index = webviewsForUri.indexOf(webviewPanel);
                if (index !== -1) {
                    webviewsForUri.splice(index, 1);
                }
                if (webviewsForUri.length === 0) {
                    delete this.webviews[uriString];
                }
            }
        });

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: []
        };

        const htmlPath = path.join(this.context.extensionPath, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        webviewPanel.webview.html = html;

        this.updateWebview(document, webviewPanel);

        webviewPanel.webview.onDidReceiveMessage(async (message) => {
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
                            const uriString = uri.toString();
                            const documentUriString = document.uri.toString();
                            
                            // Validate content before processing
                            if (!message.content || !message.content.trim()) {
                                webviewPanel.webview.postMessage({
                                    type: 'writeFile',
                                    requestId,
                                    success: false,
                                    error: 'Cannot save empty content'
                                });
                                break;
                            }

                            // Validate JSON structure
                            try {
                                const parsed = JSON.parse(message.content);
                                // Prevent saving empty objects
                                if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length === 0) {
                                    webviewPanel.webview.postMessage({
                                        type: 'writeFile',
                                        requestId,
                                        success: false,
                                        error: 'Cannot save empty scene data'
                                    });
                                    break;
                                }
                            } catch (e) {
                                webviewPanel.webview.postMessage({
                                    type: 'writeFile',
                                    requestId,
                                    success: false,
                                    error: 'Invalid JSON content'
                                });
                                break;
                            }
                            
                            if (uriString === documentUriString) {
                                this.isUpdatingFromWebview[documentUriString] = true;
                                document.makeEdit({ content: message.content });
                                try {
                                    if (message.content) {
                                        this.lastKnownSceneState[documentUriString] = JSON.parse(message.content);
                                    }
                                } catch (e) {
                                }
                                setTimeout(() => { 
                                    this.isUpdatingFromWebview[documentUriString] = false;
                                }, 100);
                            } else {
                                const edit = new vscode.WorkspaceEdit();
                                edit.replace(uri, new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE), message.content);
                                await vscode.workspace.applyEdit(edit);
                            }
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
                        const uriString = document.uri.toString();
                        this.isUpdatingFromWebview[uriString] = false;
                    }
                }
            }
        });
    }

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<SceneDocument>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    public saveCustomDocument(document: SceneDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.save(cancellation);
    }

    public saveCustomDocumentAs(document: SceneDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.saveAs(destination, cancellation);
    }

    public revertCustomDocument(document: SceneDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.revert(cancellation);
    }

    public backupCustomDocument(document: SceneDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
        return document.backup(context.destination, cancellation);
    }

    private updateWebview(document: SceneDocument, webviewPanel: vscode.WebviewPanel) {
        this.postMessage(webviewPanel, 'openScene', {
            path: document.uri.fsPath,
            content: document.documentData
        });
    }

    private postMessage(panel: vscode.WebviewPanel, command: string, body: any): void {
        panel.webview.postMessage({ command, ...body });
    }

    private async handleExternalFileChange(
        document: SceneDocument,
        changedUri: vscode.Uri
    ): Promise<void> {
        const uriString = document.uri.toString();
        
        // Skip if we're currently updating from webview to prevent feedback loops
        if (this.isUpdatingFromWebview[uriString]) {
            return;
        }

        // Add a small delay to ensure file write is complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Retry reading the file in case it's still being written
        let newContent: string | null = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts && !newContent) {
            try {
                const fileData = await vscode.workspace.fs.readFile(changedUri);
                const content = Buffer.from(fileData).toString('utf8');
                
                // Check if content is valid (not empty and looks like JSON)
                if (content.trim() && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
                    // Try to parse to validate JSON
                    JSON.parse(content);
                    newContent = content;
                } else if (content.trim()) {
                    // Content exists but doesn't look like JSON, might be mid-write
                    attempts++;
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        continue;
                    }
                } else {
                    // Empty content, skip
                    return;
                }
            } catch (error) {
                // JSON parse error or read error - might be mid-write
                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    continue;
                }
                // If we've exhausted retries, log and return
                console.warn('Failed to read file after retries:', error);
                return;
            }
        }

        if (!newContent) {
            return;
        }

        try {
            const newSceneData = JSON.parse(newContent);
            const lastKnownState = this.lastKnownSceneState[uriString];

            // If the new content is just an empty object and we have existing state, ignore it
            if (Object.keys(newSceneData).length === 0 && lastKnownState && Object.keys(lastKnownState).length > 0) {
                return;
            }

            const diff = this.computeDiff(lastKnownState, newSceneData);

            if (Object.keys(diff).length > 0) {
                this.lastKnownSceneState[uriString] = newSceneData;

                const webviewsForDocument = this.webviews[uriString] || [];
                for (const webviewPanel of webviewsForDocument) {
                    this.postMessage(webviewPanel, 'updateScene', {
                        diff: diff
                    });
                }
            }
        } catch (error: any) {
            console.error('Failed to handle external file change:', error);
            // Don't update webview on error - preserve current state
        }
    }

    private computeDiff(oldObj: any, newObj: any): any {
        if (!oldObj) {
            return JSON.parse(JSON.stringify(newObj));
        }

        const diff: any = {};

        for (const key in newObj) {
            const newValue = newObj[key];
            const oldValue = oldObj[key];

            if (!(key in oldObj)) {
                diff[key] = JSON.parse(JSON.stringify(newValue));
            } else if (this.isObject(newValue) && this.isObject(oldValue)) {
                const nestedDiff = this.computeDiff(oldValue, newValue);
                if (Object.keys(nestedDiff).length > 0) {
                    diff[key] = nestedDiff;
                }
            } else if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
                diff[key] = JSON.parse(JSON.stringify(newValue));
            }
        }

        return diff;
    }

    private isObject(value: any): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value);
    }
}


export function activate(context: vscode.ExtensionContext) {
    startViteServer(context).catch(err => {
        console.error('Failed to start Vite server during activation:', err);
    });

    context.subscriptions.push(SceneEditorProvider.register(context));
    
    const exportCommand = vscode.commands.registerCommand('natstack.exportToTauri', () => {
        exportToTauri(context);
    });
    context.subscriptions.push(exportCommand);
}

export function deactivate() {
    if (viteProcess) {
        viteProcess.kill();
        viteProcess = null;
        viteServerReady = null;
    }
}
