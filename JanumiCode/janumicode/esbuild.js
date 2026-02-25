const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

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
		build.onEnd(() => {
			const pnpmBase = path.join(__dirname, 'node_modules', '.pnpm', 'better-sqlite3@12.6.2', 'node_modules');
			const distModules = path.join(__dirname, 'dist', 'node_modules');

			// Copy better-sqlite3 to dist/node_modules
			const srcDir = path.join(pnpmBase, 'better-sqlite3');
			const destDir = path.join(distModules, 'better-sqlite3');

			if (fs.existsSync(srcDir)) {
				fs.mkdirSync(distModules, { recursive: true });
				copyRecursiveSync(srcDir, destDir);
				console.log('[copy] Copied better-sqlite3 to dist/node_modules');
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
		});
	},
};

/**
 * Recursively copy directory
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
		fs.copyFileSync(src, dest);
	}
}

async function main() {
	const ctx = await esbuild.context({
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
		external: ['vscode', 'better-sqlite3'],
		logLevel: 'silent',
		plugins: [
			copyNativeModulesPlugin,
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
