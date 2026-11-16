/**
 * What this machine runs: the Node on PATH, the running Bun, the Edge major and the SonarLint version
 * (JAN-TOOLCUR D-9 conditions 1 and 7; roadmap T0).
 *
 * ⚠ THE NODE ON PATH IS ASKED, NEVER ASSUMED. `toolchain:check` runs under Bun, and Bun's `process.version` reads
 * `v24.3.0` whatever Node is installed (F-3). The tool bins start `#!/usr/bin/env node`, so the Node they run is the
 * one PATH finds; `nodeOnPath` spawns it and asks, and also asks whether it is Bun in disguise.
 *
 * WHERE THE MACHINE TOOLS ARE comes from `machine-paths.json`, beside this file (D-13: "S1's committed machine-path
 * config is where `toolchain:check` finds Edge and SonarLint, with no hard-coded `C:/Users` paths. If T0 lands first,
 * T0 defines that config"). Its paths start with `~` (the profile) or `%VAR%` (an environment variable); a path that
 * names a user is refused by `machinePathProblems`, so the file stays usable on every operator's machine.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { compareVersions } from './matrix.js';

export interface Executable {
	readonly command: string;
	readonly args: readonly string[];
	/** A regex whose first group is the version, applied to stdout then stderr. */
	readonly version: string;
}

export interface MachinePaths {
	readonly edge: { readonly roots: readonly string[]; readonly versionDir: string };
	readonly sonarlint: { readonly roots: readonly string[]; readonly extensionDir: string };
	readonly executables: Readonly<Record<string, Executable>>;
}

/** Every reason the parsed value is not a usable machine-path config; empty when it is one. */
export function machinePathProblems(raw: unknown): string[] {
	const problems: string[] = [];
	if (raw === null || typeof raw !== 'object') return ['machine-paths.json is not a JSON object'];
	const r = raw as Record<string, unknown>;
	const roots: string[] = [];
	for (const tool of ['edge', 'sonarlint'] as const) {
		const t = r[tool] as Record<string, unknown> | undefined;
		if (t === undefined || !Array.isArray(t.roots) || t.roots.length === 0) {
			problems.push(`${tool}: no roots`);
			continue;
		}
		roots.push(...t.roots.filter((x): x is string => typeof x === 'string'));
		const pattern = tool === 'edge' ? t.versionDir : t.extensionDir;
		if (typeof pattern !== 'string' || pattern === '') problems.push(`${tool}: no directory pattern`);
	}
	if (r.executables === null || typeof r.executables !== 'object') problems.push('no executables');
	for (const root of roots) {
		if (!root.startsWith('~') && !root.startsWith('%')) {
			problems.push(`root ${JSON.stringify(root)} is neither profile- nor environment-relative`);
		}
		if (/[a-z]:[\\/]+Users[\\/]/i.test(root) || /^\/(home|Users)\//.test(root)) {
			problems.push(`root ${JSON.stringify(root)} names a user`);
		}
	}
	return problems;
}

export function parseMachinePaths(text: string): MachinePaths {
	const raw = JSON.parse(text) as unknown;
	const problems = machinePathProblems(raw);
	if (problems.length > 0) throw new Error(`machine-paths.json is not usable: ${problems.join('; ')}`);
	return raw as MachinePaths;
}

/** `~/x` -> the profile's `x`; `%VAR%/x` -> that variable's `x`. Undefined when the variable is not set here. */
export function expandRoot(root: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
	if (root.startsWith('~')) return join(homedir(), root.slice(1));
	const m = /^%([^%]+)%(.*)$/.exec(root);
	if (m === null) return undefined;
	const base = env[m[1] ?? ''];
	return base === undefined || base === '' ? undefined : join(base, m[2] ?? '');
}

export interface NodeProbe {
	readonly version: string;
	/** True when the `node` PATH finds is Bun (it reports `process.versions.bun`). */
	readonly isBun: boolean;
	readonly error?: string;
}

/** Ask the `node` that PATH finds for its version, and whether it is Bun. */
export function nodeOnPath(): NodeProbe {
	// S4036: kept - condition 1 exists to ask the Node that PATH finds, the one the gate's `#!/usr/bin/env node` bins run on.
	const r = spawnSync('node', ['-e', 'process.stdout.write(JSON.stringify({v: process.version, bun: process.versions.bun ?? null}))'], {
		encoding: 'utf8',
		timeout: 30_000
	});
	if (r.error !== undefined || r.status !== 0) {
		return { version: '', isBun: false, error: r.error?.message ?? `node exited ${r.status}: ${r.stderr.trim()}` };
	}
	try {
		const parsed = JSON.parse(r.stdout) as { v: string; bun: string | null };
		return { version: parsed.v.replace(/^v/, ''), isBun: parsed.bun !== null };
	} catch {
		return { version: '', isBun: false, error: `node printed ${JSON.stringify(r.stdout.slice(0, 200))}` };
	}
}

/** The Bun running this script, or undefined when it is not Bun. */
export function runningBun(): string | undefined {
	return process.versions.bun;
}

export interface FoundTool {
	readonly version: string;
	readonly where: string;
	readonly all: readonly string[];
}

/**
 * The highest Edge version installed under the configured roots, staged updates included: Edge keeps a folder per
 * version (`157.0.4341.42`, `157.0.4341.60`, ...) and runs a staged one at its next restart, so the highest folder is
 * the major the next e2e run can meet. Undefined when no root holds one.
 */
export function edgeInstalled(paths: MachinePaths, env: NodeJS.ProcessEnv = process.env): FoundTool | undefined {
	const pattern = new RegExp(paths.edge.versionDir);
	for (const root of paths.edge.roots) {
		const dir = expandRoot(root, env);
		if (dir === undefined || !existsSync(dir)) continue;
		const versions = readdirSync(dir).filter((name) => pattern.test(name));
		if (versions.length === 0) continue;
		versions.sort(compareVersions);
		return { version: versions.at(-1) ?? '', where: root, all: versions };
	}
	return undefined;
}

/** The versions of the SonarLint extensions in one folder, each read from the extension's own `package.json`. */
function sonarLintVersionsIn(dir: string, pattern: RegExp): string[] {
	const found: string[] = [];
	for (const name of readdirSync(dir)) {
		const manifest = join(dir, name, 'package.json');
		if (!pattern.test(name) || !existsSync(manifest)) continue;
		const version = (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown }).version;
		if (typeof version === 'string') found.push(version);
	}
	return found.sort(compareVersions);
}

/** The highest SonarLint extension under the first configured root that holds one. */
export function sonarLintInstalled(paths: MachinePaths, env: NodeJS.ProcessEnv = process.env): FoundTool | undefined {
	const pattern = new RegExp(paths.sonarlint.extensionDir);
	for (const root of paths.sonarlint.roots) {
		const dir = expandRoot(root, env);
		if (dir === undefined || !existsSync(dir)) continue;
		const found = sonarLintVersionsIn(dir, pattern);
		if (found.length > 0) return { version: found.at(-1) ?? '', where: root, all: found };
	}
	return undefined;
}

/**
 * The environment with every `node_modules/.bin` entry removed from PATH. ⚠ FOUND BY THE FIRST LIVE REVIEW: under
 * `bun run`, PATH starts with the repository's `node_modules/.bin`, which holds the Pi SDK's own `pi` (0.80.6), so the
 * machine's pi CLI (1.4.0) read as drifted. A machine tool is the machine's, not a package's bin. (The Node on PATH is
 * the opposite case: `nodeOnPath` keeps PATH as it is, because the gate's bins run on the Node that PATH finds.)
 */
export function machineEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
	const sep = process.platform === 'win32' ? ';' : ':';
	const kept = (env[key] ?? '').split(sep).filter((p) => !/node_modules[\\/]\.bin/i.test(p));
	return { ...env, [key]: kept.join(sep) };
}

/** Run one configured executable and read its version; undefined when it is absent or prints none. */
export function executableVersion(exe: Executable): string | undefined {
	// S4036: kept - a recorded-only machine tool is found on the machine's PATH (package bins removed), by design.
	const r = spawnSync(exe.command, [...exe.args], { encoding: 'utf8', timeout: 30_000, env: machineEnv() });
	if (r.error !== undefined) return undefined;
	const pattern = new RegExp(exe.version);
	const m = pattern.exec(r.stdout ?? '') ?? pattern.exec(r.stderr ?? '');
	return m?.[1];
}
