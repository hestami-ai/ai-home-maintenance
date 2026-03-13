/**
 * ensure-native-modules.js
 *
 * Detects the local VS Code Electron version and ensures that an
 * Electron-compatible better-sqlite3 binary exists in a cache directory.
 *
 * Key design: node_modules/ is NEVER modified. The Electron-specific
 * binary lives in .electron-native-cache/ and esbuild.js copies it
 * into dist/ at build time. This keeps node_modules/ compatible with
 * the system Node.js so that vitest works.
 *
 * Usage:
 *   node scripts/ensure-native-modules.js          # check + rebuild if needed
 *   node scripts/ensure-native-modules.js --force   # always rebuild
 *
 * Called automatically by the esbuild pipeline (via copyNativeModulesPlugin)
 * and can be run manually when VS Code updates.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(PROJECT_ROOT, '.electron-native-cache');
const STAMP_FILE = path.join(CACHE_DIR, 'stamp.json');

// Path to the .node binary inside node_modules (pnpm layout)
const NODE_MODULES_NATIVE = path.join(
	PROJECT_ROOT, 'node_modules', '.pnpm', 'better-sqlite3@12.6.2',
	'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'
);

// ── Detect VS Code Electron version ─────────────────────────────────

/** Returns candidate paths to the Electron "version" file for each platform. */
function getVersionFileCandidates() {
	const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

	const candidates = {
		win32: () => {
			// Windows: <LOCALAPPDATA>/Programs/Microsoft VS Code/<commitHash>/version
			const vscodeBase = path.join(localAppData, 'Programs', 'Microsoft VS Code');
			if (!fs.existsSync(vscodeBase)) { return []; }
			return fs.readdirSync(vscodeBase)
				.map(entry => path.join(vscodeBase, entry, 'version'))
				.filter(p => fs.existsSync(p));
		},
		darwin: () => [
			'/Applications/Visual Studio Code.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/Resources/version',
			path.join(os.homedir(), 'Applications/Visual Studio Code.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/Resources/version'),
		],
		linux: () => [
			'/usr/share/code/version',
			'/usr/lib/code/version',
			'/snap/code/current/usr/share/code/version',
		],
	};

	const getter = candidates[process.platform] || candidates.linux;
	return getter();
}

function detectVSCodeElectronVersion() {
	try {
		for (const candidate of getVersionFileCandidates()) {
			if (fs.existsSync(candidate)) {
				return fs.readFileSync(candidate, 'utf-8').trim();
			}
		}
	} catch (err) {
		console.warn('[native] Warning: failed to detect VS Code Electron version:', err.message);
	}
	return null;
}

// ── Stamp management ────────────────────────────────────────────────

function readStamp() {
	try {
		if (fs.existsSync(STAMP_FILE)) {
			return JSON.parse(fs.readFileSync(STAMP_FILE, 'utf-8'));
		}
	} catch { /* ignore corrupt stamp */ }
	return null;
}

function writeStamp(electronVersion, cachedNodeFile) {
	const stamp = {
		electronVersion,
		cachedNodeFile,
		rebuiltAt: new Date().toISOString(),
		platform: process.platform,
		arch: process.arch,
	};
	fs.mkdirSync(CACHE_DIR, { recursive: true });
	fs.writeFileSync(STAMP_FILE, JSON.stringify(stamp, null, 2));
}

// ── Rebuild into cache ──────────────────────────────────────────────

function rebuild(electronVersion) {
	console.log(`[native] Rebuilding better-sqlite3 for Electron ${electronVersion}...`);

	const cachedNodeFile = path.join(CACHE_DIR, `better_sqlite3-electron-${electronVersion}.node`);

	// 1. Save current system-Node binary (outside build/ — rebuild wipes it)
	fs.mkdirSync(CACHE_DIR, { recursive: true });
	const backup = path.join(CACHE_DIR, 'better_sqlite3.system-backup.node');
	if (fs.existsSync(NODE_MODULES_NATIVE)) {
		fs.copyFileSync(NODE_MODULES_NATIVE, backup);
	}

	try {
		// 2. Rebuild in-place for Electron (this is what @electron/rebuild does)
		execSync(
			`npx @electron/rebuild -v ${electronVersion} -o better-sqlite3`,
			{
				cwd: PROJECT_ROOT,
				stdio: 'inherit',
				timeout: 180_000,
			}
		);

		// 3. Cache the Electron binary
		fs.mkdirSync(CACHE_DIR, { recursive: true });
		fs.copyFileSync(NODE_MODULES_NATIVE, cachedNodeFile);

		// 4. Restore the system-Node binary so vitest still works
		if (fs.existsSync(backup)) {
			fs.mkdirSync(path.dirname(NODE_MODULES_NATIVE), { recursive: true });
			fs.copyFileSync(backup, NODE_MODULES_NATIVE);
			console.log('[native] Restored system-Node binary in node_modules/.');
		} else {
			// Backup missing (shouldn't happen) — rebuild for system Node
			console.log('[native] Backup missing, rebuilding for system Node via node-gyp...');
			const betterSqlite3Dir = path.join(PROJECT_ROOT, 'node_modules', '.pnpm',
				'better-sqlite3@12.6.2', 'node_modules', 'better-sqlite3');
			execSync(`npx node-gyp rebuild --directory=${JSON.stringify(betterSqlite3Dir)}`, {
				cwd: PROJECT_ROOT, stdio: 'inherit', timeout: 180_000,
			});
		}

		writeStamp(electronVersion, cachedNodeFile);
		console.log(`[native] Cached Electron binary at ${path.relative(PROJECT_ROOT, cachedNodeFile)}`);
		return { ok: true, cachedNodeFile };
	} catch (err) {
		// Restore system binary on failure
		if (fs.existsSync(backup)) {
			fs.mkdirSync(path.dirname(NODE_MODULES_NATIVE), { recursive: true });
			fs.copyFileSync(backup, NODE_MODULES_NATIVE);
		}
		console.error('[native] Rebuild failed:', err.message);
		return { ok: false };
	} finally {
		// Clean up backup
		try { fs.unlinkSync(backup); } catch { /* ok */ }
	}
}

// ── Main ────────────────────────────────────────────────────────────

function ensure(force = false) {
	const electronVersion = detectVSCodeElectronVersion();

	if (!electronVersion) {
		console.warn('[native] Could not detect VS Code Electron version. Skipping ABI check.');
		console.warn('[native] Run manually: node scripts/ensure-native-modules.js --force');
		return { skipped: true, reason: 'no-vscode-detected' };
	}

	console.log(`[native] VS Code Electron version: ${electronVersion}`);

	const stamp = readStamp();
	if (
		!force &&
		stamp &&
		stamp.electronVersion === electronVersion &&
		stamp.platform === process.platform &&
		stamp.arch === process.arch &&
		stamp.cachedNodeFile &&
		fs.existsSync(stamp.cachedNodeFile)
	) {
		console.log(`[native] Cached Electron binary up-to-date (${electronVersion}). Skipping rebuild.`);
		return { skipped: true, reason: 'up-to-date', cachedNodeFile: stamp.cachedNodeFile };
	}

	if (stamp) {
		console.log(`[native] Cache shows Electron ${stamp.electronVersion}, but need ${electronVersion}. Rebuilding...`);
	} else {
		console.log(`[native] No cache found. Rebuilding...`);
	}

	const result = rebuild(electronVersion);
	return { skipped: false, rebuilt: result.ok, electronVersion, cachedNodeFile: result.cachedNodeFile };
}

// Allow both CLI and programmatic usage
if (require.main === module) {
	const force = process.argv.includes('--force');
	const result = ensure(force);
	if (!result.skipped && !result.rebuilt) {
		process.exit(1);
	}
} else {
	module.exports = { ensure, detectVSCodeElectronVersion, readStamp };
}
