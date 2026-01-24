import type { Plugin } from 'vite';

/**
 * Vite plugin that automatically handles HMR for game initialization.
 * Injects HMR code into main.ts to re-initialize the game on hot updates.
 */
export function gameIDEPlugin(): Plugin {
  return {
    name: 'game-ide',
    enforce: 'pre',
    transform(code, id) {
      // Only process main.ts file
      if (!id.includes('main.ts') || id.includes('node_modules')) {
        return null;
      }

      // Check if the file contains initializeGame call
      if (!code.includes('initializeGame')) {
        return null;
      }

      // Check if HMR code is already present (to avoid double injection)
      if (code.includes('import.meta.hot.on(\'vite:afterUpdate\'')) {
        return null;
      }

      // Find the last initializeGame call and inject HMR code after it
      const initializeGameRegex = /initializeGame\(\{[^}]*\}\);?/g;
      const matches = Array.from(code.matchAll(initializeGameRegex));
      
      if (matches.length === 0) {
        return null;
      }

      // Get the last match (should be the main initialization call)
      const lastMatch = matches[matches.length - 1];
      const insertPosition = lastMatch.index! + lastMatch[0].length;

      // Extract the arguments from the initializeGame call
      const initializeGameCall = lastMatch[0];
      const argsMatch = initializeGameCall.match(/initializeGame\((\{[^}]*\})\)/);
      
      if (!argsMatch) {
        return null;
      }

      // Inject HMR code after the initializeGame call
      const hmrCode = `

// HMR support for Vite - transparent to end users
if (import.meta.hot) {
  import.meta.hot.accept(() => { });
  import.meta.hot.on('vite:afterUpdate', () => {
    initializeGame(${argsMatch[1]});
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

