import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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

export async function exportToTauri(context: vscode.ExtensionContext) {
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
            value: path.join(workspaceRoot, 'tauri-export'),
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
        
        // Create temporary build directory (will be cleaned up after build)
        const tempBuildDir = path.join(os.tmpdir(), `gameide-tauri-build-${Date.now()}`);
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exporting to Tauri Runtime",
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

            progress.report({ increment: 40, message: "Preparing build environment..." });

            // Create src-tauri structure internally in temp directory (not in runtime)
            const srcTauriPath = path.join(tempBuildDir, 'src-tauri');
            const srcTauriSrcPath = path.join(srcTauriPath, 'src');
            const distPath = path.join(tempBuildDir, 'dist');
            const tempScenesPath = path.join(tempBuildDir, 'scenes');

            // Create directories in temp location
            if (!fs.existsSync(tempBuildDir)) {
                fs.mkdirSync(tempBuildDir, { recursive: true });
            }
            if (!fs.existsSync(srcTauriPath)) {
                fs.mkdirSync(srcTauriPath, { recursive: true });
            }
            if (!fs.existsSync(srcTauriSrcPath)) {
                fs.mkdirSync(srcTauriSrcPath, { recursive: true });
            }
            if (!fs.existsSync(distPath)) {
                fs.mkdirSync(distPath, { recursive: true });
            }

            // Copy dist folder from runtime to temp (needed for build)
            const runtimeDistPath = path.join(runtimePath, 'dist');
            if (fs.existsSync(runtimeDistPath)) {
                await copyDirectory(runtimeDistPath, distPath);
            }

            // Copy scenes folder to temp (needed for resources)
            const runtimeScenesPath = path.join(runtimePath, 'scenes');
            if (fs.existsSync(runtimeScenesPath)) {
                await copyDirectory(runtimeScenesPath, tempScenesPath);
            }

            progress.report({ increment: 60, message: "Creating Tauri source files..." });

            // Generate Cargo.toml
            const cargoTomlContent = `[package]
name = "gameide-runtime"
version = "0.1.0"
description = "GameIDE Runtime"
authors = ["GameIDE"]
license = ""
repository = ""
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["macos-private-api"] }
tauri-plugin-shell = "2.0"
tauri-plugin-fs = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[features]
# This feature is used for production builds or when \`devPath\` points to the filesystem
# DO NOT REMOVE!!
custom-protocol = ["tauri/custom-protocol"]
`;
            fs.writeFileSync(path.join(srcTauriPath, 'Cargo.toml'), cargoTomlContent);

            // Generate main.rs
            const mainRsContent = `// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;
            fs.writeFileSync(path.join(srcTauriSrcPath, 'main.rs'), mainRsContent);

            // Generate build.rs
            const buildRsContent = `fn main() {
    tauri_build::build()
}
`;
            fs.writeFileSync(path.join(srcTauriPath, 'build.rs'), buildRsContent);

            // Generate tauri.conf.json
            const tauriConfContent = {
                "$schema": "https://schema.tauri.app/config/2",
                "productName": "GameIDE",
                "version": "0.1.0",
                "identifier": "com.gameide",
                "build": {
                    "frontendDist": "../dist",
                    "devUrl": "http://localhost:7777"
                },
                "app": {
                    "withGlobalTauri": false,
                    "windows": [
                        {
                            "title": "GameIDE",
                            "width": 1200,
                            "height": 800,
                            "resizable": true,
                            "fullscreen": false,
                            "label": "main"
                        }
                    ],
                    "security": {
                        "csp": "default-src 'self'; connect-src ipc: http://ipc.localhost http://localhost:* ws://localhost:*",
                        "capabilities": ["default"]
                    }
                },
                "bundle": {
                    "active": true,
                    "targets": "all",
                    "resources": [
                        "../scenes/**/*"
                    ]
                }
            };
            fs.writeFileSync(path.join(srcTauriPath, 'tauri.conf.json'), JSON.stringify(tauriConfContent, null, 2));

            // Generate capabilities/default.json
            const capabilitiesPath = path.join(srcTauriPath, 'capabilities');
            if (!fs.existsSync(capabilitiesPath)) {
                fs.mkdirSync(capabilitiesPath, { recursive: true });
            }
            const capabilitiesContent = {
                "$schema": "../gen/schemas/desktop-schema.json",
                "identifier": "default",
                "description": "Capability for the main window",
                "windows": ["main"],
                "permissions": [
                    "core:default",
                    "fs:allow-read-text-file",
                    "fs:allow-resource-read-recursive",
                    {
                        "identifier": "fs:scope",
                        "allow": ["$RESOURCE/**/*"]
                    }
                ]
            };
            fs.writeFileSync(path.join(capabilitiesPath, 'default.json'), JSON.stringify(capabilitiesContent, null, 2));

            // Generate icons
            progress.report({ increment: 65, message: "Generating icons..." });
            try {
                const assetsPath = path.join(runtimePath, 'assets');
                const possibleIconSources = [
                    path.join(assetsPath, 'icon.png'),
                    path.join(assetsPath, 'icon.svg'),
                    path.join(runtimePath, 'icon.png'),
                    path.join(runtimePath, 'icon.svg')
                ];
                
                let iconSource = null;
                for (const source of possibleIconSources) {
                    if (fs.existsSync(source)) {
                        iconSource = source;
                        break;
                    }
                }
                
                if (iconSource) {
                    // Generate icons in temp src-tauri/icons
                    const iconGenCommand = process.platform === 'win32'
                        ? `cd "${srcTauriPath}" && npx @tauri-apps/cli icon "${iconSource}"`
                        : `cd "${srcTauriPath}" && npx @tauri-apps/cli icon "${iconSource}"`;
                    
                    await execAsync(iconGenCommand, {
                        cwd: srcTauriPath,
                        maxBuffer: 10 * 1024 * 1024
                    });
                } else {
                    throw new Error('Icons are required for Tauri. Please add an icon.png or icon.svg file to runtime/assets/ or runtime/, then re-export.');
                }
            } catch (iconError: any) {
                const errorMsg = iconError.message || iconError.stderr || iconError.stdout || 'Unknown error';
                throw new Error(`Icon generation failed: ${errorMsg}\n\nIcons are required for Tauri. Please add an icon.png or icon.svg to runtime/assets/ or runtime/.`);
            }

            progress.report({ increment: 70, message: "Creating package.json..." });

            // Create package.json for Tauri app in temp build directory
            // This will reference src-tauri from the runtime directory
            const tauriPackagePath = path.join(tempBuildDir, 'package.json');
            const tauriPackageJson = {
                name: 'gameide-tauri-app',
                version: '1.0.0',
                description: 'GameIDE Tauri Runtime',
                author: 'GameIDE',
                type: 'module',
                scripts: {
                    tauri: 'tauri',
                    'tauri:dev': 'tauri dev',
                    'tauri:build': 'tauri build'
                },
                dependencies: {
                    '@tauri-apps/api': '^2.0'
                },
                devDependencies: {
                    '@tauri-apps/cli': '^2.0'
                }
            };

            fs.writeFileSync(tauriPackagePath, JSON.stringify(tauriPackageJson, null, 2));

            progress.report({ increment: 80, message: "Installing Tauri dependencies..." });

            // Install dependencies in temp build directory
            try {
                const installCommand = process.platform === 'win32' 
                    ? `cd "${tempBuildDir}" && npm install`
                    : `cd "${tempBuildDir}" && npm install`;
                
                const installResult = await execAsync(installCommand, {
                    cwd: tempBuildDir,
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                if (installResult.stderr && !installResult.stderr.includes('npm WARN')) {
                    console.log('Install stderr:', installResult.stderr);
                }
            } catch (installError: any) {
                const errorMsg = installError.stderr || installError.stdout || installError.message;
                vscode.window.showErrorMessage(`Failed to install Tauri dependencies: ${errorMsg}`);
                return;
            }

            progress.report({ increment: 90, message: "Building Tauri app..." });

            // Build the Tauri app for all platforms
            // Build from temp directory where we generated src-tauri
            try {
                // Build for all platforms: Windows, macOS, and Linux
                // Tauri CLI will find src-tauri in the current directory
                const buildCommand = process.platform === 'win32' 
                    ? `cd "${tempBuildDir}" && npx @tauri-apps/cli build --targets all`
                    : `cd "${tempBuildDir}" && npx @tauri-apps/cli build --targets all`;
                
                const buildResult = await execAsync(buildCommand, {
                    cwd: tempBuildDir,
                    maxBuffer: 100 * 1024 * 1024 // 100MB buffer for multi-platform build output
                });
                
                // Log any warnings but don't fail
                if (buildResult.stderr && !buildResult.stderr.includes('tauri')) {
                    console.log('Build stderr:', buildResult.stderr);
                }
                
                progress.report({ increment: 95, message: "Build complete! Copying binary..." });
            } catch (error: any) {
                const errorOutput = error.stderr || error.stdout || error.message;
                const fullError = `Failed to build Tauri app:\n${errorOutput}`;
                console.error('Build error:', error);
                vscode.window.showErrorMessage(fullError);
                // Clean up temp directory on error
                try {
                    fs.rmSync(tempBuildDir, { recursive: true, force: true });
                } catch (cleanupError) {
                    console.warn('Failed to clean up temp directory:', cleanupError);
                }
                return;
            }

            // Find built binaries for all platforms
            // Binaries are built in temp/src-tauri/target (will be cleaned up)
            const tempTargetPath = path.join(srcTauriPath, 'target');
            
            // Create export directory
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            
            progress.report({ increment: 96, message: "Organizing platform builds..." });
            
            // Find all target directories (each platform has its own)
            // These are in temp/src-tauri/target (will be cleaned up)
            const targetDirs: string[] = [];
            if (fs.existsSync(tempTargetPath)) {
                const entries = fs.readdirSync(tempTargetPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && entry.name !== 'debug') {
                        const releasePath = path.join(tempTargetPath, entry.name, 'release');
                        if (fs.existsSync(releasePath)) {
                            targetDirs.push(entry.name);
                        }
                    }
                }
            }
            
            const platformBuilds: string[] = [];
            
            // Copy binaries and bundles for each platform
            // Source is from temp/src-tauri/target (will be cleaned up)
            for (const target of targetDirs) {
                const releasePath = path.join(tempTargetPath, target, 'release');
                const bundlePath = path.join(releasePath, 'bundle');
                
                // Determine platform name from target
                let platformName = target;
                if (target.includes('x86_64-pc-windows-msvc') || target.includes('i686-pc-windows-msvc') || target.includes('aarch64-pc-windows-msvc')) {
                    platformName = 'windows';
                } else if (target.includes('x86_64-apple-darwin') || target.includes('aarch64-apple-darwin')) {
                    platformName = 'macos';
                } else if (target.includes('x86_64-unknown-linux') || target.includes('aarch64-unknown-linux')) {
                    platformName = 'linux';
                }
                
                const platformDir = path.join(exportDir, platformName);
                if (!fs.existsSync(platformDir)) {
                    fs.mkdirSync(platformDir, { recursive: true });
                }
                
                // Copy bundle (installer) if it exists
                if (fs.existsSync(bundlePath)) {
                    const bundleFiles = fs.readdirSync(bundlePath);
                    for (const file of bundleFiles) {
                        const srcPath = path.join(bundlePath, file);
                        const destPath = path.join(platformDir, file);
                        if (fs.statSync(srcPath).isDirectory()) {
                            await copyDirectory(srcPath, destPath);
                        } else {
                            fs.copyFileSync(srcPath, destPath);
                        }
                    }
                    platformBuilds.push(`${platformName} (installer)`);
                } else {
                    // Copy binary executable
                    const binaryName = target.includes('windows') 
                        ? 'gameide-runtime.exe'
                        : 'gameide-runtime';
                    
                    const binaryPath = path.join(releasePath, binaryName);
                    if (fs.existsSync(binaryPath)) {
                        const destPath = path.join(platformDir, binaryName);
                        fs.copyFileSync(binaryPath, destPath);
                        // Make executable on Unix systems
                        if (!target.includes('windows')) {
                            fs.chmodSync(destPath, 0o755);
                        }
                        platformBuilds.push(`${platformName} (binary)`);
                    } else {
                        // Fallback: copy entire release directory
                        await copyDirectory(releasePath, platformDir);
                        platformBuilds.push(`${platformName} (files)`);
                    }
                }
            }
            
            if (platformBuilds.length === 0) {
                throw new Error('Build completed but no binaries found for any platform');
            }
            
            // Clean up temporary build directory
            progress.report({ increment: 100, message: "Cleaning up..." });
            try {
                fs.rmSync(tempBuildDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.warn('Failed to clean up temp directory:', cleanupError);
            }
            
            const message = `Successfully built Tauri app for ${platformBuilds.length} platform(s): ${platformBuilds.join(', ')}. Files are in: ${exportDir}`;
            
            vscode.window.showInformationMessage(
                message,
                'Open Folder'
            ).then(selection => {
                if (selection === 'Open Folder') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(exportDir));
                }
            });
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Export failed: ${error.message}`);
    }
}

