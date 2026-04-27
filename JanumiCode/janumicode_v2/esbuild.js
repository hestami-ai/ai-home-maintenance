/**
 * JanumiCode v2 — Multi-entry-point esbuild pipeline.
 *
 * Produces:
 *   1. dist/extension.js          — Extension host (Node.js, CJS)
 *   2. dist/sidecar/dbServer.js   — Database sidecar process (Node.js, CJS)
 *   3. dist/webview/main.js       — Webview client (browser, IIFE) — Svelte in Wave 5
 *
 * Port of v1 pattern with native module copy plugin for better-sqlite3.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

// ── Native Module Copy Plugin ───────────────────────────────────────
// Copies better-sqlite3 and its transitive dependencies into
// dist/node_modules/ so the extension host can require() them at runtime.
//
// Under pnpm, transitive deps like `bindings` are NOT hoisted to
// node_modules/bindings — they live at
// node_modules/.pnpm/bindings@x.y.z/node_modules/bindings. Using
// require.resolve with explicit `paths` hints lets Node's own resolver find
// each module through the real pnpm layout, regardless of version.

function resolvePackageRoot(name, fromPaths) {
  // Resolve `<name>/package.json` so we can take the parent directory as the
  // package root. Direct `require.resolve(name)` would point at the main entry.
  try {
    const pkgJsonPath = require.resolve(`${name}/package.json`, { paths: fromPaths });
    return path.dirname(pkgJsonPath);
  } catch (err) {
    console.warn(`[copy-native-modules] could not resolve ${name}: ${err.message}`);
    return null;
  }
}

function copyNativeModulesPlugin() {
  return {
    name: 'copy-native-modules',
    setup(build) {
      build.onEnd(() => {
        const distNodeModules = path.join(__dirname, 'dist', 'node_modules');

        // 1. better-sqlite3 (direct dep, resolvable from __dirname)
        const sqliteRoot = resolvePackageRoot('better-sqlite3', [__dirname]);
        if (!sqliteRoot) return;
        const sqliteDest = path.join(distNodeModules, 'better-sqlite3');
        copyDirSync(sqliteRoot, sqliteDest);

        // 2. bindings and file-uri-to-path are transitive deps of
        //    better-sqlite3. Resolve them with the better-sqlite3 package root
        //    as the starting point so pnpm's per-package node_modules is found.
        const transitive = ['bindings', 'file-uri-to-path'];
        for (const name of transitive) {
          const root = resolvePackageRoot(name, [sqliteRoot, __dirname]);
          if (!root) continue;
          copyDirSync(root, path.join(distNodeModules, name));
        }
      });
    },
  };
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (err) {
        // Handle Windows file locks (EBUSY/EPERM) on .node files
        if ((err.code === 'EBUSY' || err.code === 'EPERM') && entry.name.endsWith('.node')) {
          const stale = destPath + '.stale';
          try {
            fs.renameSync(destPath, stale);
            fs.copyFileSync(srcPath, destPath);
          } catch {
            // Best effort — skip if still locked
          }
        }
      }
    }
  }
}

// ── Shared Options ──────────────────────────────────────────────────

const sharedOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
};

// ── Build Configurations ────────────────────────────────────────────

// 1. Extension Host — Node.js CJS
const extensionBuild = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: [
    'vscode',
    'better-sqlite3',
    '@sqliteai/sqlite-vector',
  ],
};

// 2. Sidecar Database Server — Node.js CJS
const sidecarBuild = {
  ...sharedOptions,
  entryPoints: ['src/sidecar/dbServer.ts'],
  outfile: 'dist/sidecar/dbServer.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: [
    'better-sqlite3',
    '@sqliteai/sqlite-vector',
  ],
  plugins: [copyNativeModulesPlugin()],
};

// 2b. RPC Worker — Node.js worker_threads bridge that spawns the sidecar.
//     Runs inside the extension host via `new Worker(workerPath)`.
const rpcWorkerBuild = {
  ...sharedOptions,
  entryPoints: ['src/lib/database/rpcWorker.ts'],
  outfile: 'dist/rpcWorker.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // The worker itself uses built-in worker_threads + child_process; no externals.
};

// 2c. CLI Entry Point — Headless workflow execution.
//     Standalone Node.js CLI for test harness and automation.
const cliBuild = {
  ...sharedOptions,
  entryPoints: ['src/cli/index.ts'],
  outfile: 'dist/cli/janumicode.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // Shebang comes from the source file (src/cli/index.ts line 1).
  // Do NOT add a banner here — esbuild preserves the source shebang.
  external: [
    'better-sqlite3',
    '@sqliteai/sqlite-vector',
  ],
};

// 3. Webview Client — Browser IIFE with Svelte 5
//
// We do NOT use vitePreprocess({ script: true }) here. It uses Vite's Oxc
// transformer with the wrong defaults for Svelte: see
// node_modules/@sveltejs/vite-plugin-svelte/src/preprocess.js lines 46-57,
// where importsNotUsedAsValues: 'preserve' is commented out with a TODO.
// Without it, the TS transform strips component imports like
// `import Card from './Card.svelte'` whenever the script body never
// references `Card` at the value level (typical: it's only used in the
// template). The compiled bundle then references undefined symbols at
// runtime — the exact "Card is not defined" / "IntentComposer is not
// defined" failure mode we hit.
//
// The shared `tsScriptPreprocessor` in scripts/svelteTsPreprocessor.js
// hands script blocks to esbuild's own TS transform with
// `verbatimModuleSyntax: true`, guaranteeing every import survives. The
// vitest config uses the same module so production and test compilation
// agree on Svelte preprocessing.
const sveltePlugin = require('esbuild-svelte');
const { tsScriptPreprocessor } = require('./scripts/svelteTsPreprocessor');

const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/main.ts'],
  outfile: 'dist/webview/main.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte', 'browser'],
  plugins: [
    sveltePlugin({
      preprocess: tsScriptPreprocessor(),
      compilerOptions: {
        css: 'injected',
      },
    }),
    // Copy the design system's CSS to dist/webview/ so the extension host
    // (governedStreamViewProvider.buildHtml) can read it and inline its
    // custom properties into the webview HTML. Keeps design-system.css
    // as the single source of truth for JanumiCode design tokens.
    {
      name: 'copy-design-system-css',
      setup(build) {
        build.onEnd(() => {
          const src = path.join(__dirname, 'src', 'webview', 'design-system.css');
          const dest = path.join(__dirname, 'dist', 'webview', 'design-system.css');
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        });
      },
    },
  ],
};

// 4. Canvas Webview Client -- Browser IIFE with Svelte 5
//    Architecture Canvas visualization with Canvas 2D rendering.
const canvasWebviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/canvas/main.ts'],
  outfile: 'dist/webview/canvas.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte', 'browser'],
  plugins: [
    sveltePlugin({
      preprocess: tsScriptPreprocessor(),
      compilerOptions: {
        css: 'injected',
      },
    }),
    {
      name: 'copy-design-system-css-for-canvas',
      setup(build) {
        build.onEnd(() => {
          // Ensure design-system.css is copied (may already exist from webview build)
          const src = path.join(__dirname, 'src', 'webview', 'design-system.css');
          const dest = path.join(__dirname, 'dist', 'webview', 'design-system.css');
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
          }
        });
      },
    },
  ],
};

// 5. Decomposition Viewer Webview Client -- Browser IIFE with Svelte
//    Wave 7 Phase 2 visualization (Option 7 Multi-Level Accordion).
const decompViewerWebviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/decompViewer/main.ts'],
  outfile: 'dist/webview/decompViewer.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte', 'browser'],
  plugins: [
    sveltePlugin({
      preprocess: tsScriptPreprocessor(),
      compilerOptions: {
        css: 'injected',
      },
    }),
    {
      name: 'copy-design-system-css-for-decomp-viewer',
      setup(build) {
        build.onEnd(() => {
          const src = path.join(__dirname, 'src', 'webview', 'design-system.css');
          const dest = path.join(__dirname, 'dist', 'webview', 'design-system.css');
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
          }
        });
      },
    },
  ],
};

// ── Execute Builds ──────────────────────────────────────────────────

async function build() {
  const configs = [extensionBuild, sidecarBuild, rpcWorkerBuild, cliBuild, webviewBuild, canvasWebviewBuild, decompViewerWebviewBuild];

  if (isWatch) {
    const contexts = await Promise.all(
      configs.map(config => esbuild.context(config))
    );
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(
      configs.map(config => esbuild.build(config))
    );
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
