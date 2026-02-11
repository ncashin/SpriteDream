import type { Plugin } from 'vite';

export function gameIDEPlugin(): Plugin {
    return {
        name: 'gameIDE',
        enforce: 'pre',
        transform(code, id) {
            // === Handle initializeGame HMR insertion ===
            let transformed = code;

            if (id.includes('main.ts') && !id.includes('node_modules')) {
                if (code.includes('initializeGame')
                    && !code.includes("import.meta.hot.on('vite:afterUpdate'")) {
                    const initializeGameIndex = code.lastIndexOf('initializeGame(');
                    if (initializeGameIndex !== -1) {
                        let braceStart = code.indexOf('{', initializeGameIndex);
                        if (braceStart !== -1) {
                            let braceCount = 0;
                            let braceEnd = braceStart;
                            for (let i = braceStart; i < code.length; i++) {
                                if (code[i] === '{') braceCount++;
                                if (code[i] === '}') braceCount--;
                                if (braceCount === 0) {
                                    braceEnd = i;
                                    break;
                                }
                            }

                            if (braceCount === 0) {
                                let parenEnd = code.indexOf(')', braceEnd);
                                if (parenEnd !== -1) {
                                    let semicolonPos = code.indexOf(';', parenEnd);
                                    const insertPosition = semicolonPos !== -1 ? semicolonPos + 1 : parenEnd + 1;

                                    const objectArg = code.slice(braceStart, braceEnd + 1);

                                    const hmrCode = `

// HMR support for Vite - transparent to end users
if (import.meta.hot) {
  const handleAfterUpdate = () => { initializeGame(${objectArg}); };
  import.meta.hot.accept(() => { });
  import.meta.hot.on('vite:afterUpdate', handleAfterUpdate);
  import.meta.hot.dispose(() => {
    import.meta.hot.off('vite:afterUpdate', handleAfterUpdate);
  });
}`;
                                    transformed =
                                        code.slice(0, insertPosition) +
                                        hmrCode +
                                        code.slice(insertPosition);
                                }
                            }
                        }
                    }
                }
            }

            // === Handle loadScene HMR for ?raw scene imports ===
            // Look for a function call to loadScene(...) where a raw scene import variable is passed
            // For simplicity, find all loadScene( ...something ending in ?raw...) or `loadScene(var)` where var is imported from ?raw
            // For maintainability, only handle direct imports like: import myScene from "...?raw";
            // We'll refresh the whole scene by reinvoking loadScene with the raw import

            // Parse for imported raw scenes
            // Example: import myScene from "...?raw";
            //           loadScene(myScene);
            const importRawRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+["'][^"']+\.scene\?raw["'];/g;
            let rawScenes: string[] = [];
            let match;
            while ((match = importRawRegex.exec(transformed)) !== null) {
                rawScenes.push(match[1]);
            }

            // If any loadScene([sceneVar]) appears, add HMR for that
            rawScenes.forEach(sceneVar => {
                // match: loadScene(<sceneVar>)
                // naive regex to match loadScene(sceneVar) that is not a method
                const loadSceneRegex = new RegExp(`loadScene\\s*\\(\\s*${sceneVar}\\s*\\)`);
                if (
                    loadSceneRegex.test(transformed) &&
                    !transformed.includes(`import.meta.hot.on('vite:afterUpdate:scene:${sceneVar}'`)
                ) {
                    // Insert HMR code after loadScene call
                    const loadSceneCallIndex = transformed.indexOf(`loadScene`);
                    if (loadSceneCallIndex !== -1) {
                        // Find the end of the statement (semicolon or end of parenthesis)
                        let parenStart = transformed.indexOf('(', loadSceneCallIndex);
                        let parenCount = 0;
                        let parenEnd = parenStart;
                        for (let i = parenStart; i < transformed.length; i++) {
                            if (transformed[i] === '(') parenCount++;
                            if (transformed[i] === ')') parenCount--;
                            if (parenCount === 0) {
                                parenEnd = i;
                                break;
                            }
                        }
                        let sceneSemicolon = transformed.indexOf(';', parenEnd);
                        let insertPos = sceneSemicolon !== -1 ? sceneSemicolon + 1 : parenEnd + 1;

                        const hmrSceneCode = `

// HMR: Hot reload for scene changes (${sceneVar})
if (import.meta.hot) {
  const handleSceneUpdate = () => { loadScene(${sceneVar}); };
  import.meta.hot.accept(() => { });
  import.meta.hot.on('vite:afterUpdate', handleSceneUpdate);
  import.meta.hot.dispose(() => {
    import.meta.hot.off('vite:afterUpdate', handleSceneUpdate);
  });
}`;
                        transformed =
                            transformed.slice(0, insertPos) +
                            hmrSceneCode +
                            transformed.slice(insertPos);
                    }
                }
            });

            if (transformed !== code) {
                return {
                    code: transformed,
                    map: null,
                };
            }
            return null;
        },
    };
}

