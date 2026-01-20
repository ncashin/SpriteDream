import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as archiver from 'archiver';
import * as FormData from 'form-data';

const execAsync = promisify(exec);

interface BundleManifest {
    version: string;
    name: string;
    description: string;
    bundle: {
        [key: string]: {
            source: string;
            required: boolean;
            description: string;
        };
    };
    metadata?: {
        name?: string;
        description?: string;
        author?: string;
        thumbnail?: string;
    };
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/png';
}

async function loadManifest(runtimePath: string): Promise<BundleManifest> {
    const manifestPath = path.join(runtimePath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found at ${manifestPath}. Please create a manifest.json file in the runtime directory.`);
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    let manifest: BundleManifest;
    try {
        manifest = JSON.parse(manifestContent) as BundleManifest;
    } catch (error: any) {
        throw new Error(`Invalid manifest JSON: ${error.message}`);
    }

    if (!manifest.bundle || typeof manifest.bundle !== 'object') {
        throw new Error('Invalid manifest: "bundle" field is required and must be an object');
    }

    for (const [key, entry] of Object.entries(manifest.bundle)) {
        if (!entry.source || typeof entry.source !== 'string') {
            throw new Error(`Invalid manifest: bundle entry "${key}" must have a "source" string field`);
        }
        if (typeof entry.required !== 'boolean') {
            throw new Error(`Invalid manifest: bundle entry "${key}" must have a "required" boolean field`);
        }
    }

    return manifest;
}

async function copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        entry.isDirectory() 
            ? await copyDirectory(srcPath, destPath)
            : fs.copyFileSync(srcPath, destPath);
    }
}

async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function buildRuntime(runtimePath: string, progress: (increment: number, message: string) => void): Promise<void> {
    const nodeModulesPath = path.join(runtimePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        progress(10, "Installing dependencies...");
        try {
            const result = await execAsync(`cd "${runtimePath}" && npm install`, {
                cwd: runtimePath,
                maxBuffer: 10 * 1024 * 1024
            });
            if (result.stderr && !result.stderr.includes('npm WARN')) {
                console.log('Install stderr:', result.stderr);
            }
        } catch (error: any) {
            const errorMsg = error.stderr || error.stdout || error.message;
            throw new Error(`Failed to install dependencies: ${errorMsg}`);
        }
    }

    progress(20, "Building runtime...");
    await execAsync(`cd "${runtimePath}" && npx tsc`, {
        cwd: runtimePath,
        maxBuffer: 10 * 1024 * 1024
    });

    const buildResult = await execAsync(`cd "${runtimePath}" && npx vite build --base ./`, {
        cwd: runtimePath,
        maxBuffer: 10 * 1024 * 1024
    });

    if (buildResult.stderr) {
        console.log('Build stderr:', buildResult.stderr);
    }

    progress(30, "Runtime built successfully");
}

async function loadThumbnail(thumbnailPath: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!fs.existsSync(thumbnailPath)) {
        return null;
    }
    try {
        return {
            buffer: fs.readFileSync(thumbnailPath),
            mimeType: getMimeType(thumbnailPath)
        };
    } catch {
        return null;
    }
}

async function createBundleFromManifest(manifest: BundleManifest, runtimePath: string, tempBundleDir: string): Promise<void> {
    const missingRequired: string[] = [];

    for (const [bundleKey, bundleEntry] of Object.entries(manifest.bundle)) {
        const sourcePath = path.join(runtimePath, bundleEntry.source);
        const destPath = path.join(tempBundleDir, bundleKey);

        if (!fs.existsSync(sourcePath)) {
            if (bundleEntry.required) {
                missingRequired.push(`${bundleKey} (${bundleEntry.source})`);
            } else {
                vscode.window.showWarningMessage(`Optional bundle entry "${bundleKey}" (${bundleEntry.source}) not found, skipping.`);
            }
            continue;
        }

        const stats = fs.statSync(sourcePath);
        if (stats.isDirectory()) {
            await copyDirectory(sourcePath, destPath);
        } else {
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(sourcePath, destPath);
        }
    }

    if (missingRequired.length > 0) {
        throw new Error(
            `Required bundle entries not found:\n${missingRequired.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Please ensure these files/folders exist in the runtime directory.`
        );
    }
}

async function formDataToBuffer(formData: FormData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let completed = false;

        const finish = (result: Buffer | Error) => {
            if (completed) return;
            completed = true;
            result instanceof Error ? reject(result) : resolve(result);
        };

        formData.on('data', (chunk: Buffer | string) => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
        });

        formData.once('end', () => finish(Buffer.concat(chunks)));
        formData.once('error', finish);

        setImmediate(() => {
            if (!completed && formData.readable) {
                (formData as any).resume?.() || formData.resume?.();
            }
        });
    });
}

function extractGameId(url: string): string | null {
    return url.match(/\/games\/(\d+)/)?.[1] || null;
}

async function showSuccessMessage(gameId: string | null, finalUrl: string, websiteUrl: string): Promise<void> {
    if (!gameId) {
        vscode.window.showInformationMessage('Game uploaded successfully!');
        return;
    }

    const selection = await vscode.window.showInformationMessage(
        `Game uploaded successfully! Game ID: ${gameId}`,
        'Open Game Page'
    );

    if (selection === 'Open Game Page') {
        vscode.env.openExternal(vscode.Uri.parse(finalUrl.startsWith('http') ? finalUrl : `${websiteUrl}${finalUrl}`));
    }
}

export async function uploadGame(context: vscode.ExtensionContext) {
    try {
        if (!vscode.workspace.workspaceFolders?.length) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const websiteUrl = await vscode.window.showInputBox({
            prompt: 'Enter the website URL (e.g., http://localhost:5173)',
            value: 'http://localhost:5173',
            validateInput: (value) => {
                if (!value?.trim()) return 'URL cannot be empty';
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Invalid URL format';
                }
            }
        });

        if (!websiteUrl) return;

        const runtimePath = path.join(context.extensionPath, '..', 'runtime');
        let manifestMetadata: BundleManifest['metadata'] | undefined;
        
        try {
            manifestMetadata = (await loadManifest(runtimePath)).metadata;
        } catch (error) {
            console.log('Manifest not available, continuing without metadata:', error);
        }

        const name = await vscode.window.showInputBox({
            prompt: 'Enter game name',
            value: manifestMetadata?.name || '',
            validateInput: (value) => (!value?.trim() ? 'Game name is required' : null)
        });

        if (!name) return;

        const description = await vscode.window.showInputBox({
            prompt: 'Enter game description (optional)',
            value: manifestMetadata?.description || ''
        });

        const author = await vscode.window.showInputBox({
            prompt: 'Enter author name (optional)',
            value: manifestMetadata?.author || ''
        });

        let thumbnail: { buffer: Buffer; mimeType: string } | null = null;

        if (manifestMetadata?.thumbnail) {
            const thumbnailPath = path.isAbsolute(manifestMetadata.thumbnail)
                ? manifestMetadata.thumbnail
                : path.join(runtimePath, manifestMetadata.thumbnail);
            thumbnail = await loadThumbnail(thumbnailPath);
            if (!thumbnail) {
                vscode.window.showWarningMessage(`Thumbnail path from manifest not found: ${thumbnailPath}`);
            }
        }

        if (!thumbnail) {
            const thumbnailUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select Thumbnail',
                filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
            });

            if (thumbnailUri?.length) {
                try {
                    const fileData = await vscode.workspace.fs.readFile(thumbnailUri[0]);
                    thumbnail = {
                        buffer: Buffer.from(fileData),
                        mimeType: getMimeType(thumbnailUri[0].fsPath)
                    };
                } catch (error: any) {
                    vscode.window.showWarningMessage(`Failed to read thumbnail: ${error.message}`);
                }
            }
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Game",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Building runtime..." });

            try {
                await buildRuntime(runtimePath, (increment, message) => progress.report({ increment, message }));
            } catch (error: any) {
                const errorOutput = error.stderr || error.stdout || error.message;
                vscode.window.showErrorMessage(`Failed to build runtime:\n${errorOutput}`);
                return;
            }

            progress.report({ increment: 40, message: "Loading manifest..." });

            let manifest: BundleManifest;
            try {
                manifest = await loadManifest(runtimePath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to load manifest: ${error.message}`);
                return;
            }

            progress.report({ increment: 45, message: "Creating game bundle from manifest..." });

            const tempBundleDir = path.join(os.tmpdir(), `gameide-bundle-${Date.now()}`);
            fs.mkdirSync(tempBundleDir, { recursive: true });

            try {
                await createBundleFromManifest(manifest, runtimePath, tempBundleDir);
            } catch (error: any) {
                vscode.window.showErrorMessage(error.message);
                return;
            }

            progress.report({ increment: 60, message: "Creating ZIP archive..." });

            const zipPath = path.join(os.tmpdir(), `gameide-game-${Date.now()}.zip`);

            try {
                await createZipArchive(tempBundleDir, zipPath);
            } catch (error: any) {
                try {
                    fs.rmSync(tempBundleDir, { recursive: true, force: true });
                } catch { }

                const selection = await vscode.window.showErrorMessage(
                    `Failed to create ZIP: ${error.message}\n\nPlease install zip tool or manually create a ZIP of the dist and scenes folders.`,
                    'Open Bundle Folder'
                );

                if (selection === 'Open Bundle Folder') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(tempBundleDir));
                }
                return;
            }

            progress.report({ increment: 80, message: "Uploading to website..." });

            const zipBuffer = fs.readFileSync(zipPath);
            const formData = new FormData();

            formData.append('name', name);
            if (description) formData.append('description', description);
            if (author) formData.append('author', author);
            if (thumbnail) {
                formData.append('thumbnail', thumbnail.buffer, {
                    filename: `thumbnail${thumbnail.mimeType === 'image/png' ? '.png' : '.jpg'}`,
                    contentType: thumbnail.mimeType
                });
            }
            formData.append('gameBundle', zipBuffer, {
                filename: 'game.zip',
                contentType: 'application/zip'
            });

            try {
                const formBuffer = await formDataToBuffer(formData);
                const response = await fetch(`${websiteUrl}/upload`, {
                    method: 'POST',
                    body: new Uint8Array(formBuffer),
                    headers: formData.getHeaders(),
                    redirect: 'follow'
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} ${response.statusText}\n${errorText}`);
                }

                progress.report({ increment: 100, message: "Upload complete!" });

                const gameId = extractGameId(response.url) || extractGameId(response.headers.get('location') || '');
                await showSuccessMessage(gameId, response.url, websiteUrl);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Upload failed: ${error.message}`);
            } finally {
                try {
                    fs.rmSync(tempBundleDir, { recursive: true, force: true });
                    if (fs.existsSync(zipPath)) {
                        fs.unlinkSync(zipPath);
                    }
                } catch (cleanupError) {
                    console.warn('Failed to clean up temp files:', cleanupError);
                }
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Upload failed: ${error.message}`);
    }
}
