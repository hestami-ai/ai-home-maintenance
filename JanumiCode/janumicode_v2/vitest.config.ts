import { defineConfig } from 'vitest/config';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tsScriptPreprocessor } = require('./scripts/svelteTsPreprocessor');

export default defineConfig({
  // Svelte plugin so vitest can transform .svelte files when test files
  // import them. Uses our shared TS preprocessor (the one esbuild.js also
  // uses) so component imports are preserved at the source level — same
  // verbatimModuleSyntax fix that keeps the production build correct.
  plugins: [
    svelte({
      preprocess: tsScriptPreprocessor(),
      // Tests run in node/happy-dom; SSR-mode compile is fine and avoids
      // CSS-injection ceremony we don't need for assertions.
      compilerOptions: {
        css: 'injected',
      },
    }),
  ],
  test: {
    root: '.',
    include: [
      'src/test/unit/**/*.test.ts',
      'src/test/integration/**/*.test.ts',
    ],
    exclude: [
      'src/test/prompt-probes/**',
    ],
    // Default to node env. Card / DOM tests opt into happy-dom via the
    // `// @vitest-environment happy-dom` annotation at the top of the file.
    environment: 'node',
    globals: false,
    setupFiles: ['src/test/helpers/setup.ts'],
    testTimeout: 30000,
    server: {
      deps: {
        // Force vitest to inline the Svelte runtime + svelteTestHelpers so
        // they get the per-file environment (happy-dom) instead of being
        // pulled from the node module cache where window is undefined.
        inline: ['svelte', /\.svelte$/],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/test/**', 'src/webview/**', 'src/sidecar/**'],
    },
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@sidecar': path.resolve(__dirname, 'src/sidecar'),
      '@test': path.resolve(__dirname, 'src/test'),
      'vscode': path.resolve(__dirname, 'src/test/helpers/mocks/vscode.ts'),
    },
    // Force vitest to pick Svelte's client/browser build, not the SSR build.
    // Without these conditions, `import { mount } from 'svelte'` resolves to
    // svelte/src/index-server.js (where mount is a stub that throws
    // "lifecycle_function_unavailable") instead of the real client mount.
    conditions: ['browser', 'svelte', 'module', 'import', 'default'],
  },
});
