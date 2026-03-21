/**
 * WSL 2 Utility Module
 * Provides WSL detection, path conversion, and command wrapping
 * for CLI providers that run inside WSL (e.g., opencode, deepagents).
 *
 * Used by: OpenCodeCLIProvider, future DeepAgentsCLIProvider
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

const IS_WINDOWS = process.platform === 'win32';

/** Cached WSL detection result (cleared on reload). */
let _wslCache: { available: boolean; distros: string[] } | undefined;

/**
 * Detect whether WSL is available and which distros are installed.
 * Caches the result for the lifetime of the extension host.
 */
export async function detectWSL(): Promise<{ available: boolean; distros: string[] }> {
	if (_wslCache) {
		return _wslCache;
	}

	if (!IS_WINDOWS) {
		_wslCache = { available: false, distros: [] };
		return _wslCache;
	}

	try {
		const { stdout } = await execAsync('wsl.exe --list --quiet', { timeout: 5000 });
		// wsl --list --quiet outputs one distro per line, may contain BOM/null bytes
		const distros = stdout
			.replace(/\0/g, '')  // strip null bytes from UTF-16LE output
			.split(/\r?\n/)
			.map((d) => d.trim())
			.filter(Boolean);

		_wslCache = { available: distros.length > 0, distros };
		return _wslCache;
	} catch {
		_wslCache = { available: false, distros: [] };
		return _wslCache;
	}
}

/** Clear the WSL detection cache (for testing). */
export function clearWSLCache(): void {
	_wslCache = undefined;
}

/**
 * Check if the extension host is running inside WSL (VS Code Remote - WSL).
 * If true, WSL CLIs can be spawned directly without wsl.exe wrapping.
 */
export function isRunningInWSL(): boolean {
	return vscode.env.remoteName === 'wsl';
}

/**
 * Convert a Windows filesystem path to its WSL /mnt/ equivalent.
 * E.g., `E:\Projects\foo` → `/mnt/e/Projects/foo`
 *
 * If the path is already a Unix-style path, returns it unchanged.
 */
export function toWslPath(windowsPath: string): string {
	// Already a Unix path
	if (windowsPath.startsWith('/')) {
		return windowsPath;
	}

	// Match drive letter pattern: C:\ or C:/
	const match = /^([A-Za-z]):[/\\](.*)$/.exec(windowsPath);
	if (!match) {
		return windowsPath;
	}

	const driveLetter = match[1].toLowerCase();
	const rest = match[2].replace(/\\/g, '/');
	return `/mnt/${driveLetter}/${rest}`;
}

/**
 * Build a command + args for spawning a CLI either directly (in WSL remote)
 * or via wsl.exe wrapper (on Windows host).
 *
 * Uses `zsh -ic` (interactive zsh) so the user's .zshrc is loaded,
 * which is required for tools installed in custom locations (e.g.,
 * ~/.opencode/bin) that are only added to PATH in .zshrc.
 *
 * When a cwd is provided, the command is prefixed with `cd <wsl_path> &&`
 * since Node's `cwd` spawn option only applies to the Windows side.
 */
export function buildWslCommand(
	distro: string,
	command: string,
	args: string[],
	cwd?: string,
): { command: string; args: string[] } {
	if (isRunningInWSL()) {
		// Extension host is in WSL — spawn directly
		return { command, args };
	}

	// Windows host — wrap via wsl.exe with login zsh for full PATH
	const escapedArgs = args.map((a) => shellEscape(a));
	const fullCommand = [command, ...escapedArgs].join(' ');

	if (cwd) {
		const wslCwd = toWslPath(cwd);
		return {
			command: 'wsl.exe',
			args: ['-d', distro, '--', 'zsh', '-ic', `cd ${shellEscape(wslCwd)} && ${fullCommand}`],
		};
	}

	return {
		command: 'wsl.exe',
		args: ['-d', distro, '--', 'zsh', '-ic', fullCommand],
	};
}

/**
 * Check if a specific command is available inside a WSL distro.
 */
export async function isCommandAvailableInWSL(
	distro: string,
	command: string,
): Promise<{ available: boolean; version?: string }> {
	if (isRunningInWSL()) {
		try {
			const { stdout } = await execAsync(`${command} --version`, { timeout: 5000 });
			return { available: true, version: stdout.trim() };
		} catch {
			return { available: false };
		}
	}

	if (!IS_WINDOWS) {
		return { available: false };
	}

	try {
		const { stdout } = await execAsync(
			`wsl.exe -d ${distro} -- zsh -ic "${command} --version"`,
			{ timeout: 10000 },
		);
		return { available: true, version: stdout.replace(/\0/g, '').trim() };
	} catch {
		return { available: false };
	}
}

/**
 * Escape a string for safe use in a bash shell command.
 */
function shellEscape(s: string): string {
	if (/^[a-zA-Z0-9._/=-]+$/.test(s)) {
		return s;
	}
	return `'${s.replace(/'/g, "'\\''")}'`;
}
