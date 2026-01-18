import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as archiver from 'archiver';
import * as FormData from 'form-data';

const execAsync = promisify(exec);

async function copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) { 
            await copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        output.on('close', () => {
            resolve();
        });

        archive.on('error', (err: Error) => {
            reject(err);
        });

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function buildRuntime(runtimePath: string, progress: (increment: number, message: string) => void): Promise<void> {
    // Check if node_modules exists
    const nodeModulesPath = path.join(runtimePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        progress(10, "Installing dependencies...");
        const installCommand = process.platform === 'win32' 
            ? `cd "${runtimePath}" && npm install`
            : `cd "${runtimePath}" && npm install`;
        
        try {
            const installResult = await execAsync(installCommand, {
                cwd: runtimePath,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            if (installResult.stderr && !installResult.stderr.includes('npm WARN')) {
                console.log('Install stderr:', installResult.stderr);
            }
        } catch (installError: any) {
            const errorMsg = installError.stderr || installError.stdout || installError.message;
            throw new Error(`Failed to install dependencies: ${errorMsg}`);
        }
    }

    progress(20, "Building runtime...");
    // Build with relative base path
    const tscCommand = process.platform === 'win32' 
        ? `cd "${runtimePath}" && npx tsc`
        : `cd "${runtimePath}" && npx tsc`;
    
    await execAsync(tscCommand, {
        cwd: runtimePath,
        maxBuffer: 10 * 1024 * 1024
    });
    
    const viteBuildCommand = process.platform === 'win32' 
        ? `cd "${runtimePath}" && npx vite build --base ./`
        : `cd "${runtimePath}" && npx vite build --base ./`;
    
    const buildResult = await execAsync(viteBuildCommand, {
        cwd: runtimePath,
        maxBuffer: 10 * 1024 * 1024
    });
    
    if (buildResult.stderr) {
        console.log('Build stderr:', buildResult.stderr);
    }
    
    progress(30, "Runtime built successfully");
}

export async function uploadGame(context: vscode.ExtensionContext) {
    try {
        // Get workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Get website URL from user or use default
        const websiteUrl = await vscode.window.showInputBox({
            prompt: 'Enter the website URL (e.g., http://localhost:5173)',
            value: 'http://localhost:5173',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'URL cannot be empty';
                }
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Invalid URL format';
                }
            }
        });

        if (!websiteUrl) {
            return;
        }

        // Collect game information
        const name = await vscode.window.showInputBox({
            prompt: 'Enter game name',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Game name is required';
                }
                return null;
            }
        });

        if (!name) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Enter game description (optional)',
        });

        const author = await vscode.window.showInputBox({
            prompt: 'Enter author name (optional)',
        });

        // Ask for thumbnail
        const thumbnailUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select Thumbnail',
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp']
            }
        });

        let thumbnailBuffer: Buffer | null = null;
        let thumbnailMimeType: string | null = null;

        if (thumbnailUri && thumbnailUri.length > 0) {
            try {
                const fileData = await vscode.workspace.fs.readFile(thumbnailUri[0]);
                thumbnailBuffer = Buffer.from(fileData);
                const ext = path.extname(thumbnailUri[0].fsPath).toLowerCase();
                thumbnailMimeType = ext === '.png' ? 'image/png' :
                                   ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                                   ext === '.gif' ? 'image/gif' :
                                   ext === '.webp' ? 'image/webp' : 'image/png';
            } catch (error: any) {
                vscode.window.showWarningMessage(`Failed to read thumbnail: ${error.message}`);
            }
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Game",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Building runtime..." });

            // Get runtime path
            const runtimePath = path.join(context.extensionPath, '..', 'runtime');
            
            // Build the runtime
            try {
                await buildRuntime(runtimePath, (increment, message) => {
                    progress.report({ increment, message });
                });
            } catch (error: any) {
                const errorOutput = error.stderr || error.stdout || error.message;
                const fullError = `Failed to build runtime:\n${errorOutput}`;
                console.error('Build error:', error);
                vscode.window.showErrorMessage(fullError);
                return;
            }

            progress.report({ increment: 40, message: "Creating game bundle..." });

            // Create temporary directory for bundle
            const tempBundleDir = path.join(os.tmpdir(), `natstack-bundle-${Date.now()}`);
            const distPath = path.join(tempBundleDir, 'dist');
            const scenesPath = path.join(tempBundleDir, 'scenes');

            // Create directories
            if (!fs.existsSync(tempBundleDir)) {
                fs.mkdirSync(tempBundleDir, { recursive: true });
            }

            // Copy dist folder from runtime
            const runtimeDistPath = path.join(runtimePath, 'dist');
            if (fs.existsSync(runtimeDistPath)) {
                await copyDirectory(runtimeDistPath, distPath);
            } else {
                throw new Error('Runtime dist folder not found. Please build the runtime first.');
            }

            // Copy scenes folder
            const runtimeScenesPath = path.join(runtimePath, 'scenes');
            if (fs.existsSync(runtimeScenesPath)) {
                await copyDirectory(runtimeScenesPath, scenesPath);
            }

            progress.report({ increment: 60, message: "Creating ZIP archive..." });

            // Create ZIP file
            const zipPath = path.join(os.tmpdir(), `natstack-game-${Date.now()}.zip`);
            
            try {
                await createZipArchive(tempBundleDir, zipPath);
            } catch (error: any) {
                // Clean up temp directory
                try {
                    fs.rmSync(tempBundleDir, { recursive: true, force: true });
                } catch {}
                
                // Try alternative: use JSZip approach via a simple implementation
                // For now, show error and suggest manual upload
                vscode.window.showErrorMessage(
                    `Failed to create ZIP: ${error.message}\n\nPlease install zip tool or manually create a ZIP of the dist and scenes folders.`,
                    'Open Bundle Folder'
                ).then(selection => {
                    if (selection === 'Open Bundle Folder') {
                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(tempBundleDir));
                    }
                });
                return;
            }

            progress.report({ increment: 80, message: "Uploading to website..." });

            // Read ZIP file
            const zipBuffer = fs.readFileSync(zipPath);

            // Create FormData using form-data package
            const formData = new FormData();
            
            formData.append('name', name);
            if (description) {
                formData.append('description', description);
            }
            if (author) {
                formData.append('author', author);
            }
            if (thumbnailBuffer) {
                formData.append('thumbnail', thumbnailBuffer, {
                    filename: 'thumbnail' + (thumbnailMimeType === 'image/png' ? '.png' : '.jpg'),
                    contentType: thumbnailMimeType || 'image/png'
                });
            }
            formData.append('gameBundle', zipBuffer, {
                filename: 'game.zip',
                contentType: 'application/zip'
            });
            
            const formHeaders = formData.getHeaders();

            // Convert form-data stream to Buffer for fetch compatibility
            // The form-data package creates a readable stream that needs to be consumed
            const formBuffer = await new Promise<Buffer>((resolve, reject) => {
                const chunks: Buffer[] = [];
                let completed = false;
                
                const finish = (result: Buffer | Error) => {
                    if (completed) return;
                    completed = true;
                    if (result instanceof Error) {
                        reject(result);
                    } else {
                        resolve(result);
                    }
                };
                
                // Set up all event handlers
                // form-data emits both strings (boundaries) and Buffers (file data)
                formData.on('data', (chunk: Buffer | string) => {
                    // Convert strings to Buffers if needed
                    if (typeof chunk === 'string') {
                        chunks.push(Buffer.from(chunk, 'utf8'));
                    } else {
                        chunks.push(chunk);
                    }
                });
                
                formData.once('end', () => {
                    finish(Buffer.concat(chunks));
                });
                
                formData.once('error', (err: Error) => {
                    finish(err);
                });
                
                // Critical: form-data streams must be explicitly started
                // Put the stream in flowing mode by calling resume()
                setImmediate(() => {
                    if (!completed && formData.readable) {
                        // Resume the stream to start emitting data events
                        // This is essential - form-data streams won't emit data until resumed
                        if (typeof (formData as any).resume === 'function') {
                            (formData as any).resume();
                        } else if (typeof formData.resume === 'function') {
                            formData.resume();
                        }
                    }
                });
            });

            // Upload to website
            try {
                const uploadUrl = `${websiteUrl}/upload`;
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formBuffer,
                    headers: formHeaders,
                    redirect: 'follow' // Explicitly follow redirects
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} ${response.statusText}\n${errorText}`);
                }

                // Success - the upload completed
                progress.report({ increment: 100, message: "Upload complete!" });
                
                // Try to extract game ID from the final URL (after redirect)
                const finalUrl = response.url;
                const gameIdMatch = finalUrl.match(/\/games\/(\d+)/);
                
                if (gameIdMatch) {
                    const gameId = gameIdMatch[1];
                    vscode.window.showInformationMessage(
                        `Game uploaded successfully! Game ID: ${gameId}`,
                        'Open Game Page'
                    ).then(selection => {
                        if (selection === 'Open Game Page') {
                            vscode.env.openExternal(vscode.Uri.parse(finalUrl));
                        }
                    });
                } else {
                    // If redirect was followed, try to get location from response
                    const location = response.headers.get('location');
                    if (location) {
                        const gameId = location.match(/\/games\/(\d+)/)?.[1];
                        if (gameId) {
                            vscode.window.showInformationMessage(
                                `Game uploaded successfully! Game ID: ${gameId}`,
                                'Open Game Page'
                            ).then(selection => {
                                if (selection === 'Open Game Page') {
                                    vscode.env.openExternal(vscode.Uri.parse(`${websiteUrl}${location}`));
                                }
                            });
                        } else {
                            vscode.window.showInformationMessage('Game uploaded successfully!');
                        }
                    } else {
                        vscode.window.showInformationMessage('Game uploaded successfully!');
                    }
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Upload failed: ${error.message}`);
                return;
            } finally {
                // Clean up temporary files
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

