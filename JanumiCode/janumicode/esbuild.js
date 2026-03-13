const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const { ensure: ensureNativeModules } = require("./scripts/ensure-native-modules");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * Copy native modules plugin
 * @type {import('esbuild').Plugin}
 */
const copyNativeModulesPlugin = {
	name: 'copy-native-modules',

	setup(build) {
		// Ensure Electron-compatible native binary exists in cache (first build only)
		let ensureResult = null;
		build.onEnd(() => {
			if (!ensureResult) {
				ensureResult = ensureNativeModules();
			}

			const pnpmBase = path.join(__dirname, 'node_modules', '.pnpm', 'better-sqlite3@12.6.2', 'node_modules');
			const distModules = path.join(__dirname, 'dist', 'node_modules');

			// Copy better-sqlite3 JS/package from node_modules to dist/
			const srcDir = path.join(pnpmBase, 'better-sqlite3');
			const destDir = path.join(distModules, 'better-sqlite3');

			if (fs.existsSync(srcDir)) {
				fs.mkdirSync(distModules, { recursive: true });
				copyRecursiveSync(srcDir, destDir);
				console.log('[copy] Copied better-sqlite3 to dist/node_modules');
			}

			// Overlay the Electron-compiled .node binary from cache
			if (ensureResult && ensureResult.cachedNodeFile && fs.existsSync(ensureResult.cachedNodeFile)) {
				const destNodeFile = path.join(destDir, 'build', 'Release', 'better_sqlite3.node');
				fs.mkdirSync(path.dirname(destNodeFile), { recursive: true });
				copyFileWithRetry(ensureResult.cachedNodeFile, destNodeFile);
				console.log('[copy] Overlaid Electron-compiled .node from cache');
			}

			// Copy bindings (required by better-sqlite3 to locate native .node file)
			const bindingsSrc = path.join(pnpmBase, 'bindings');
			const bindingsDest = path.join(distModules, 'bindings');

			if (fs.existsSync(bindingsSrc)) {
				copyRecursiveSync(bindingsSrc, bindingsDest);
				console.log('[copy] Copied bindings to dist/node_modules');
			}

			// Copy file-uri-to-path (required by bindings)
			const fileUriSrc = path.join(__dirname, 'node_modules', '.pnpm', 'file-uri-to-path@1.0.0', 'node_modules', 'file-uri-to-path');
			const fileUriDest = path.join(distModules, 'file-uri-to-path');

			if (fs.existsSync(fileUriSrc)) {
				copyRecursiveSync(fileUriSrc, fileUriDest);
				console.log('[copy] Copied file-uri-to-path to dist/node_modules');
			}

			// Copy @sqliteai/sqlite-vector (optional: vector embedding support)
			const sqliteVectorSrc = path.join(__dirname, 'node_modules', '@sqliteai', 'sqlite-vector');
			const sqliteVectorDest = path.join(distModules, '@sqliteai', 'sqlite-vector');

			if (fs.existsSync(sqliteVectorSrc)) {
				copyRecursiveSync(sqliteVectorSrc, sqliteVectorDest);
				console.log('[copy] Copied @sqliteai/sqlite-vector to dist/node_modules');
			}
		});
	},
};

/**
 * Copy a single file, handling EBUSY/EPERM on Windows when VS Code
 * has the .node file loaded. Renames the locked file out of the way
 * (Windows allows renaming loaded DLLs), then copies fresh.
 */
function copyFileWithRetry(src, dest) {
	try {
		fs.copyFileSync(src, dest);
	} catch (err) {
		if (err.code === 'EBUSY' || err.code === 'EPERM') {
			const stale = dest + '.old';
			try { fs.unlinkSync(stale); } catch { /* may not exist */ }
			fs.renameSync(dest, stale);
			fs.copyFileSync(src, dest);
			console.log(`[copy] Replaced locked file (old renamed to ${path.basename(stale)})`);
		} else {
			throw err;
		}
	}
}

/**
 * Recursively copy directory.
 * @param {string} src Source directory
 * @param {string} dest Destination directory
 */
function copyRecursiveSync(src, dest) {
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();

	if (isDirectory) {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		fs.readdirSync(src).forEach((childItemName) => {
			copyRecursiveSync(
				path.join(src, childItemName),
				path.join(dest, childItemName)
			);
		});
	} else {
		copyFileWithRetry(src, dest);
	}
}

async function main() {
	// Extension host build (Node.js / CommonJS)
	const extensionCtx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode', 'better-sqlite3', '@sqliteai/sqlite-vector'],
		logLevel: 'silent',
		plugins: [
			copyNativeModulesPlugin,
			esbuildProblemMatcherPlugin,
		],
	});

	// Webview client build (Browser / IIFE)
	const webviewCtx = await esbuild.context({
		entryPoints: [
			'src/webview/main.ts'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/webview/governedStream.js',
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	// MCP Permission Server build (Node.js / CommonJS — standalone process)
	const mcpServerCtx = await esbuild.context({
		entryPoints: [
			'src/lib/mcp/permissionServer.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/mcp/permissionServer.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	if (watch) {
		await Promise.all([extensionCtx.watch(), webviewCtx.watch(), mcpServerCtx.watch()]);
	} else {
		await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild(), mcpServerCtx.rebuild()]);
		await extensionCtx.dispose();
		await webviewCtx.dispose();
		await mcpServerCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
