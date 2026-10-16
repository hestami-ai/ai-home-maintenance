// ⭐ R3-C (`REG-F-512` candidate 1's fifth part; the lead's delegated decision of 2026-10-16, to be registered as
// REG-D-114) — EVERY LIVE LANE'S SERVER RUNS PI OFFLINE, AND NOTHING LATER IN ITS ENVIRONMENT SETS IT AGAIN.
//
// ⭑ WHAT `PI_OFFLINE` CHANGES, read in the installed Pi (`@earendil-works/pi-coding-agent` 0.80.6). It is read in five
// files of the coding agent and nowhere else: `dist/core/package-manager.js` (a missing package is not installed, and
// no update is looked for or fetched), `dist/utils/tools-manager.js` (fd and rg are not downloaded),
// `dist/utils/version-check.js` (no version check), `dist/main.js` (the CLI's start) and
// `dist/modes/interactive/interactive-mode.js` (no package-update check, no install telemetry). ⛔ No file of `pi-ai` or
// `pi-agent-core`, which make the model calls, names it — held below against the installed packages, so a Pi upgrade
// that reads it anywhere else reddens here until someone decides about it. `playwright.live-exec.config.ts` says which
// of those reads the server reaches.
// ⭑ READ FROM THE CONFIGS' SOURCE, never loaded: loading `playwright.live-exec.config.ts` runs its lane-key refusal, and
// no live lane runs here. Playwright starts the server with `{ ...process.env, ...webServer.env }`
// (`verif/live-backend-isolation.reporter.ts`), so the value a config sets is the server's whatever the operator's shell
// holds — when nothing after it in the same literal sets it again, which is why it must come last.
// ⛔ THE POPULATION IS EVERY PLAYWRIGHT CONFIG OF THE APP WHOSE NAME SAYS `live`, so a live lane added later reddens here
// until its server is offline too.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('../apps/rph-demo/', import.meta.url));
const LIVE_CONFIG = /^playwright\.[^/]*live[^/]*\.config\.ts$/;

/** The live lanes' configs, by file name. */
const liveConfigs = (): string[] =>
	readdirSync(APP)
		.filter((name) => LIVE_CONFIG.test(name))
		.sort();

/** What a config's `webServer.env` sets `PI_OFFLINE` to, as source text, and whether that is the literal's last word. */
function piOfflineOf(name: string): { readonly value: string; readonly last: boolean } {
	const source = ts.createSourceFile(
		name,
		readFileSync(join(APP, name), 'utf8'),
		ts.ScriptTarget.Latest,
		true
	);
	const envs: ts.ObjectLiteralExpression[] = [];
	const visit = (node: ts.Node): void => {
		if (
			ts.isPropertyAssignment(node) &&
			node.name.getText(source) === 'env' &&
			ts.isObjectLiteralExpression(node.initializer) &&
			ts.isObjectLiteralExpression(node.parent) &&
			ts.isPropertyAssignment(node.parent.parent) &&
			node.parent.parent.name.getText(source) === 'webServer'
		)
			envs.push(node.initializer);
		ts.forEachChild(node, visit);
	};
	visit(source);
	if (envs.length !== 1) return { value: `${envs.length} webServer.env literals`, last: false };
	const properties = envs[0]!.properties;
	const at = properties.findIndex(
		(p) => p.name !== undefined && p.name.getText(source) === 'PI_OFFLINE'
	);
	const property = properties[at];
	if (property === undefined) return { value: 'absent', last: false };
	return {
		value: ts.isPropertyAssignment(property) ? property.initializer.getText(source) : 'not a value',
		last: at === properties.length - 1
	};
}

/** An installed Pi package's folder — beside the app, or hoisted to the repository's root. */
function installed(pkg: string): string {
	const found = [
		`../apps/rph-demo/node_modules/@earendil-works/${pkg}`,
		`../node_modules/@earendil-works/${pkg}`
	]
		.map((relative) => fileURLToPath(new URL(relative, import.meta.url)))
		.find((path) => existsSync(join(path, 'package.json')));
	expect(found, `arrangement: ${pkg} is installed`).toBeDefined();
	return found!;
}

/** Every `.js` file under `dir` whose text holds `needle`, relative to `dir`, with forward slashes. */
function filesHolding(dir: string, needle: string): string[] {
	const out: string[] = [];
	const walk = (at: string): void => {
		for (const name of readdirSync(at)) {
			const path = join(at, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (name.endsWith('.js') && readFileSync(path, 'utf8').includes(needle))
				out.push(
					path
						.slice(dir.length + 1)
						.split('\\')
						.join('/')
				);
		}
	};
	walk(dir);
	return out.sort();
}

describe('⭐ every live lane’s server runs Pi offline (the lead’s delegated decision of 2026-10-16, to be registered as REG-D-114)', () => {
	it('⭑ CONTROL — the population holds the two live lanes: the execution lane and the authoring lane', () => {
		expect(liveConfigs()).toEqual(
			expect.arrayContaining(['playwright.live-exec.config.ts', 'playwright.live.config.ts'])
		);
	});

	it('⛔ each live lane’s webServer.env sets PI_OFFLINE to 1, last, so nothing spread or set after it overrides it', () => {
		expect(Object.fromEntries(liveConfigs().map((name) => [name, piOfflineOf(name)]))).toEqual(
			Object.fromEntries(liveConfigs().map((name) => [name, { value: "'1'", last: true }]))
		);
	});

	it('⛔ PI_OFFLINE touches no model call: no file of pi-ai or pi-agent-core names it, and the coding agent reads it in its five files alone', () => {
		// ⭑ The two packages that make a model call are searched for the NAME, anywhere — a read, a help text, a key.
		expect(filesHolding(join(installed('pi-ai'), 'dist'), 'PI_OFFLINE')).toEqual([]);
		expect(filesHolding(join(installed('pi-agent-core'), 'dist'), 'PI_OFFLINE')).toEqual([]);
		// ⭑ CONTROL, and the coding agent's reads: the search reads the installed files, and finds the five.
		expect(
			filesHolding(join(installed('pi-coding-agent'), 'dist'), 'process.env.PI_OFFLINE')
		).toEqual([
			'core/package-manager.js',
			'main.js',
			'modes/interactive/interactive-mode.js',
			'utils/tools-manager.js',
			'utils/version-check.js'
		]);
	});
});
