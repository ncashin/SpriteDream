import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

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

export async function exportToElectron(context: vscode.ExtensionContext) {
    try {
        // Get workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Ask user for export destination
        const exportPath = await vscode.window.showInputBox({
            prompt: 'Enter the export directory path',
            value: path.join(workspaceRoot, 'electron-export'),
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Path cannot be empty';
                }
                return null;
            }
        });

        if (!exportPath) {
            return;
        }

        const exportDir = path.resolve(exportPath);
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exporting to Electron Runtime",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Building runtime..." });

            // Get runtime path
            const runtimePath = path.join(context.extensionPath, '..', 'runtime');
            
            // Build the runtime
            try {
                // Check if node_modules exists
                const nodeModulesPath = path.join(runtimePath, 'node_modules');
                if (!fs.existsSync(nodeModulesPath)) {
                    progress.report({ increment: 10, message: "Installing dependencies..." });
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
                        vscode.window.showErrorMessage(`Failed to install dependencies: ${errorMsg}`);
                        return;
                    }
                }

                progress.report({ increment: 20, message: "Building runtime..." });
                // Build with relative base path for Electron compatibility
                // First compile TypeScript, then build with Vite using relative paths
                const tscCommand = process.platform === 'win32' 
                    ? `cd "${runtimePath}" && npx tsc`
                    : `cd "${runtimePath}" && npx tsc`;
                
                await execAsync(tscCommand, {
                    cwd: runtimePath,
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                const viteBuildCommand = process.platform === 'win32' 
                    ? `cd "${runtimePath}" && npx vite build --base ./`
                    : `cd "${runtimePath}" && npx vite build --base ./`;
                
                const buildResult = await execAsync(viteBuildCommand, {
                    cwd: runtimePath,
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                // Log any warnings but don't fail
                if (buildResult.stderr) {
                    console.log('Build stderr:', buildResult.stderr);
                }
                
                progress.report({ increment: 30, message: "Runtime built successfully" });
            } catch (error: any) {
                const errorOutput = error.stderr || error.stdout || error.message;
                const fullError = `Failed to build runtime:\n${errorOutput}`;
                console.error('Build error:', error);
                vscode.window.showErrorMessage(fullError);
                return;
            }

            progress.report({ increment: 40, message: "Creating Electron app structure..." });

            // Create export directory structure
            const electronMainDir = path.join(exportDir, 'electron');
            const electronMainPath = path.join(electronMainDir, 'main.js');
            const electronPackagePath = path.join(exportDir, 'package.json');
            const distPath = path.join(exportDir, 'dist');

            // Create directories
            if (!fs.existsSync(electronMainDir)) {
                fs.mkdirSync(electronMainDir, { recursive: true });
            }
            if (!fs.existsSync(distPath)) {
                fs.mkdirSync(distPath, { recursive: true });
            }

            // Copy dist folder from runtime
            const runtimeDistPath = path.join(runtimePath, 'dist');
            if (fs.existsSync(runtimeDistPath)) {
                await copyDirectory(runtimeDistPath, distPath);
            }

            // Copy scenes folder if it exists
            const runtimeScenesPath = path.join(runtimePath, 'scenes');
            const exportScenesPath = path.join(exportDir, 'scenes');
            if (fs.existsSync(runtimeScenesPath)) {
                await copyDirectory(runtimeScenesPath, exportScenesPath);
            }

            progress.report({ increment: 60, message: "Creating Electron main process..." });

            // Create Electron main.js
            const electronMainContent = `const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true
        }
    });

    // Load the built app
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    
    // Check if file exists
    if (!fs.existsSync(indexPath)) {
        console.error('Index file not found at:', indexPath);
        win.loadURL('data:text/html,<h1>Error: index.html not found</h1><p>' + indexPath + '</p>');
        return;
    }
    
    win.loadFile(indexPath).catch(err => {
        console.error('Failed to load file:', err);
        win.loadURL('data:text/html,<h1>Error loading app</h1><p>' + err.message + '</p>');
        return;
    });

    // Wait for page to load, then send message to load default scene
    win.webContents.once('did-finish-load', () => {
        // Small delay to ensure message listener is ready
        setTimeout(() => {
            // Try to load default scene from scenes folder
            const scenesPath = path.join(__dirname, '..', 'scenes', 'default.scene');
            if (fs.existsSync(scenesPath)) {
                try {
                    const sceneContent = fs.readFileSync(scenesPath, 'utf8');
                    const escapedContent = JSON.stringify(sceneContent);
                    // Send message event to load the scene
                    const script = 'window.dispatchEvent(new MessageEvent("message", { data: { command: "openScene", path: "scenes/default.scene", content: ' + escapedContent + ' } }));';
                    win.webContents.executeJavaScript(script).catch(err => {
                        console.error('Failed to execute scene load script:', err);
                    });
                } catch (err) {
                    console.error('Failed to load default scene:', err);
                }
            } else {
                console.warn('Default scene not found at:', scenesPath);
                // List available scene files
                const scenesDir = path.join(__dirname, '..', 'scenes');
                if (fs.existsSync(scenesDir)) {
                    const files = fs.readdirSync(scenesDir);
                    console.log('Available scene files:', files);
                    // Try to load the first .scene file found
                    const sceneFiles = files.filter(f => f.endsWith('.scene'));
                    if (sceneFiles.length > 0) {
                        const firstScene = sceneFiles[0];
                        const scenePath = path.join(scenesDir, firstScene);
                        try {
                            const sceneContent = fs.readFileSync(scenePath, 'utf8');
                            const escapedContent = JSON.stringify(sceneContent);
                            const script = 'window.dispatchEvent(new MessageEvent("message", { data: { command: "openScene", path: "scenes/' + firstScene + '", content: ' + escapedContent + ' } }));';
                            win.webContents.executeJavaScript(script).catch(err => {
                                console.error('Failed to execute scene load script:', err);
                            });
                        } catch (err) {
                            console.error('Failed to load scene file:', err);
                        }
                    }
                }
            }
        }, 500);
    });

    // Log console messages from renderer
    win.webContents.on('console-message', (event, level, message) => {
        console.log('[Renderer ' + level + ']:', message);
    });

    // Handle page load errors
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Page failed to load:', errorCode, errorDescription);
    });

    // Open DevTools for debugging (uncomment to debug)
    win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
`;

            fs.writeFileSync(electronMainPath, electronMainContent);

            progress.report({ increment: 80, message: "Creating package.json..." });

            // Remove existing package.json and node_modules if they exist to ensure clean state
            if (fs.existsSync(electronPackagePath)) {
                fs.unlinkSync(electronPackagePath);
            }
            const nodeModulesPath = path.join(exportDir, 'node_modules');
            if (fs.existsSync(nodeModulesPath)) {
                fs.rmSync(nodeModulesPath, { recursive: true, force: true });
            }

            // Create package.json for Electron app
            const electronPackageJson = {
                name: 'natstack-electron-app',
                version: '1.0.0',
                description: 'NatStack Electron Runtime',
                author: 'NatStack',
                main: 'electron/main.js',
                scripts: {
                    start: 'electron .',
                    build: 'electron-builder',
                    'build:dir': 'electron-builder --dir',
                    'build:all': 'electron-builder -mwl'
                },
                devDependencies: {
                    electron: '^27.0.0',
                    'electron-builder': '^24.6.4'
                },
                build: {
                    appId: 'com.natstack.app',
                    productName: 'NatStack',
                    directories: {
                        output: 'release'
                    },
                    files: [
                        'dist/**/*',
                        'electron/**/*',
                        'scenes/**/*',
                        'package.json'
                    ],
                    mac: {
                        category: 'public.app-category.developer-tools',
                        target: ['dmg', 'zip']
                    },
                    win: {
                        target: ['nsis', 'portable']
                    },
                    linux: {
                        target: ['AppImage', 'deb']
                    },
                    nsis: {
                        oneClick: false,
                        allowToChangeInstallationDirectory: true
                    }
                }
            };

            fs.writeFileSync(electronPackagePath, JSON.stringify(electronPackageJson, null, 2));

            progress.report({ increment: 85, message: "Installing Electron dependencies..." });

            // Install dependencies in export directory
            try {
                const installCommand = process.platform === 'win32' 
                    ? `cd "${exportDir}" && npm install`
                    : `cd "${exportDir}" && npm install`;
                
                const installResult = await execAsync(installCommand, {
                    cwd: exportDir,
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                if (installResult.stderr && !installResult.stderr.includes('npm WARN')) {
                    console.log('Install stderr:', installResult.stderr);
                }
            } catch (installError: any) {
                const errorMsg = installError.stderr || installError.stdout || installError.message;
                vscode.window.showErrorMessage(`Failed to install Electron dependencies: ${errorMsg}`);
                return;
            }

            progress.report({ increment: 90, message: "Packaging binary..." });

            // Build the packaged binary
            try {
                const buildCommand = process.platform === 'win32' 
                    ? `cd "${exportDir}" && npm run build`
                    : `cd "${exportDir}" && npm run build`;
                
                const buildResult = await execAsync(buildCommand, {
                    cwd: exportDir,
                    maxBuffer: 50 * 1024 * 1024 // 50MB buffer for electron-builder output
                });
                
                // Log any warnings but don't fail
                if (buildResult.stderr && !buildResult.stderr.includes('electron-builder')) {
                    console.log('Build stderr:', buildResult.stderr);
                }
                
                progress.report({ increment: 100, message: "Packaging complete!" });
            } catch (error: any) {
                const errorOutput = error.stderr || error.stdout || error.message;
                const fullError = `Failed to package binary:\n${errorOutput}`;
                console.error('Package error:', error);
                vscode.window.showErrorMessage(fullError);
                return;
            }
        });

        const releasePath = path.join(exportDir, 'release');
        const releaseExists = fs.existsSync(releasePath);
        
        const message = releaseExists 
            ? `Successfully packaged Electron app! Binary is in: ${releasePath}`
            : `Successfully exported to Electron runtime at: ${exportDir}`;
        
        vscode.window.showInformationMessage(
            message,
            'Open Folder'
        ).then(selection => {
            if (selection === 'Open Folder') {
                const pathToOpen = releaseExists ? releasePath : exportDir;
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(pathToOpen));
            }
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Export failed: ${error.message}`);
    }
}

