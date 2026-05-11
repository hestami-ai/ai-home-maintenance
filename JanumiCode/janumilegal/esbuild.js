/**
 * JanumiLegal — esbuild pipeline.
 *
 * Produces:
 *   1. dist/extension.js          — Extension host (Node.js, CJS)
 *   2. dist/sidecar/dbServer.js   — Database sidecar process (Node.js, CJS)
 *   3. dist/rpcWorker.js          — RPC worker bridging extension host to sidecar
 *   4. dist/webview/main.js       — Webview client (browser, IIFE) with Svelte
 *
 * The four-bundle layout mirrors JanumiCode v2's pattern but is independently
 * implemented; no source is shared.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

// ── Native module copy plugin ──────────────────────────────────────
// better-sqlite3 ships a .node native binding. esbuild can't bundle that;
// we copy the package tree into dist/node_modules/ so Node can require it.
function resolvePackageRoot(name, fromPaths) {
  try {
    const pkgJsonPath = require.resolve(`${name}/package.json`, { paths: fromPaths });
    return path.dirname(pkgJsonPath);
  } catch (err) {
    console.warn(`[copy-native-modules] could not resolve ${name}: ${err.message}`);
    return null;
  }
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
        if ((err.code === 'EBUSY' || err.code === 'EPERM') && entry.name.endsWith('.node')) {
          const stale = destPath + '.stale';
          try {
            fs.renameSync(destPath, stale);
            fs.copyFileSync(srcPath, destPath);
          } catch {
            // best effort
          }
        }
      }
    }
  }
}

function copyNativeModulesPlugin() {
  return {
    name: 'copy-native-modules',
    setup(build) {
      build.onEnd(() => {
        const distNodeModules = path.join(__dirname, 'dist', 'node_modules');
        const sqliteRoot = resolvePackageRoot('better-sqlite3', [__dirname]);
        if (!sqliteRoot) return;
        copyDirSync(sqliteRoot, path.join(distNodeModules, 'better-sqlite3'));
        for (const name of ['bindings', 'file-uri-to-path']) {
          const root = resolvePackageRoot(name, [sqliteRoot, __dirname]);
          if (!root) continue;
          copyDirSync(root, path.join(distNodeModules, name));
        }
      });
    },
  };
}

// ── Shared options ──────────────────────────────────────────────────
const sharedOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
};

// 1. Extension host
const extensionBuild = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vscode', 'better-sqlite3'],
};

// 2. Sidecar DB server
const sidecarBuild = {
  ...sharedOptions,
  entryPoints: ['src/sidecar/dbServer.ts'],
  outfile: 'dist/sidecar/dbServer.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['better-sqlite3'],
  plugins: [copyNativeModulesPlugin()],
};

// 3. RPC worker (worker_threads bridge from extension host to sidecar)
const rpcWorkerBuild = {
  ...sharedOptions,
  entryPoints: ['src/lib/database/rpcWorker.ts'],
  outfile: 'dist/rpcWorker.js',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
};

// 4. Webview client (Svelte 5)
let sveltePlugin;
try {
  sveltePlugin = require('esbuild-svelte');
} catch {
  // svelte plugin optional during initial bootstrap; falls back to no-op
  sveltePlugin = null;
}

const webviewBuild = sveltePlugin
  ? {
      ...sharedOptions,
      entryPoints: ['src/webview/main.ts'],
      outfile: 'dist/webview/main.js',
      platform: 'browser',
      format: 'iife',
      target: 'es2022',
      mainFields: ['svelte', 'browser', 'module', 'main'],
      conditions: ['svelte', 'browser'],
      plugins: [sveltePlugin({ compilerOptions: { css: 'injected' } })],
    }
  : {
      ...sharedOptions,
      entryPoints: ['src/webview/main.ts'],
      outfile: 'dist/webview/main.js',
      platform: 'browser',
      format: 'iife',
      target: 'es2022',
    };

async function build() {
  const configs = [extensionBuild, sidecarBuild, rpcWorkerBuild, webviewBuild];
  if (isWatch) {
    const contexts = await Promise.all(configs.map((c) => esbuild.context(c)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(configs.map((c) => esbuild.build(c)));
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
