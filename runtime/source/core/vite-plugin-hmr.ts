import type { Plugin } from 'vite';

export function gameIDEPlugin(): Plugin {
    return {
        name: 'gameIDE',
        enforce: 'pre',
        transform(code, id) {
            if (!id.includes('main.ts') || id.includes('node_modules')) {
                return null;
            }

            if (!code.includes('initializeGame')) {
                return null;
            }

            if (code.includes('import.meta.hot.on(\'vite:afterUpdate\'')) {
                return null;
            }

            const initializeGameIndex = code.lastIndexOf('initializeGame(');
            if (initializeGameIndex === -1) {
                return null;
            }

            let braceStart = code.indexOf('{', initializeGameIndex);
            if (braceStart === -1) {
                return null;
            }

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

            if (braceCount !== 0) {
                return null;
            }

            let parenEnd = code.indexOf(')', braceEnd);
            if (parenEnd === -1) {
                return null;
            }

            let semicolonPos = code.indexOf(';', parenEnd);
            const insertPosition = semicolonPos !== -1 ? semicolonPos + 1 : parenEnd + 1;

            const objectArg = code.slice(braceStart, braceEnd + 1);

            const hmrCode = `

// HMR support for Vite - transparent to end users
if (import.meta.hot) {
  import.meta.hot.accept(() => { });
  import.meta.hot.on('vite:afterUpdate', () => {
    initializeGame(${objectArg});
  });
}`;

            const transformedCode =
                code.slice(0, insertPosition) +
                hmrCode +
                code.slice(insertPosition);

            return {
                code: transformedCode,
                map: null,
            };
        },
    };
}

