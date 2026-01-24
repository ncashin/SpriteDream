import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { gameIDEPlugin } from './source/core/vite-plugin-hmr';

export default defineConfig(({ mode }) => {
  // Check if we're building with editor enabled
  const editorEnabled = mode === 'editor';

  return {
    plugins: [react(), tailwindcss(), gameIDEPlugin()],
    publicDir: 'assets',
    define: {
      // Define build-time constant for editor mode
      'import.meta.env.VITE_EDITOR_ENABLED': JSON.stringify(editorEnabled),
    },
    server: {
      port: 7777,
      strictPort: true,
      watch: {
        ignored: ['**/scenes/**'],
      },
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 5,
          unsafe: true,
          unsafe_comps: true,
          unsafe_math: true,
          unsafe_methods: true,
          unsafe_proto: true,
          unsafe_regexp: true,
          unsafe_undefined: true,
        },
        mangle: {
          toplevel: true,
          properties: {
            regex: /^_/,
          },
          safari10: false,
        },
        format: {
          comments: false,
        },
      } as any,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});
