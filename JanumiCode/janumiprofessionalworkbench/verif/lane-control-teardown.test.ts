// ⛔ THE LANE CONTROL'S RUN VERDICT — every kept violation fails the run (`JAN-CRITREAD` J1-3;
// `DESIGN-what-the-tests-prove.md` §4.8; `REG-D-072` D8).
//
// The server keeps what it finds across every reset and retry; `apps/rph-demo/e2e/lane-control-teardown.ts` asks for it
// once, at the end, and fails the run on any of it. That last decision is the one a per-test fixture cannot make: with
// `retries: 1`, a test that fails its first attempt and passes its retry exits 0. So it gets its own guard here, without
// a browser. ⭑ Its browser-level counterpart was driven by hand in J1-3: a scratch spec forging a pass on its first
// attempt only reported `1 flaky`, and exited 1 with this verdict, 0 with it disabled.
//
// ⛔⛔ AND THE VERDICT IS ONLY AS GOOD AS ITS WIRING, which is two lines this file now holds as well (J1-3's adversarial
// review, its one MAJOR): the `globalTeardown` entry in `apps/rph-demo/playwright.config.ts` that makes Playwright call
// the teardown at all, and the `throw` in the teardown's default export that turns the verdict into a failed run. With
// either gone, a violation that passed on retry exits 0 and every other lane guard stays green — measured by the review
// with the config entry removed. So the config is read from its AST (never a substring grep), and the default export is
// driven against a local server standing in for `/test-api/lane-control`: a report that holds a violation must throw,
// and one that holds none must not. Both run in `gate:fast`'s vitest steps, not only under `bun run mutants`.
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import laneControlTeardown, {
	laneRunVerdict,
	type KeptViolation
} from '../apps/rph-demo/e2e/lane-control-teardown.js';

/** The app whose DEFAULT Playwright config runs the lane — the directory its `globalTeardown` paths resolve from. */
const APP = fileURLToPath(new URL('../apps/rph-demo/', import.meta.url));
const CONFIG = resolve(APP, 'playwright.config.ts');
/** The module this file imports and drives — the one the config's entry must name. */
const TEARDOWN = resolve(APP, 'e2e', 'lane-control-teardown.ts');

const kept = (over: Partial<KeptViolation>): KeptViolation => ({
	limb: 2,
	where: 'canonical',
	assessmentId: 'asmt-1',
	segment: 2,
	attributedTo: ['spec › test'],
	seenAt: 'reset',
	reason: 'a SATISFIED reasoning review completed under forged.reasoning-review',
	...over
});

describe('⛔ the final call fails the run on ANY kept violation', () => {
	it('⭐ CONTROL — nothing kept is a clean lane', () => {
		expect(laneRunVerdict({ marks: [1, 2, 3], violations: [] })).toBeUndefined();
	});

	it('⛔ a violation only an AFTER-TEST CHECK saw — a test that failed once and passed on retry — still fails the run', () => {
		const verdict = laneRunVerdict({
			marks: [1, 2, 3],
			violations: [kept({ seenAt: 'after-test check', attributedTo: ['spec › flaky'] })]
		});
		expect(verdict).toContain('1 reasoning-review pass(es) the lane may not rest on');
		expect(verdict).toContain('spec › flaky');
	});

	it('⛔ a violation from an EARLIER segment — a floor that completed after its test, read at the next reset — fails it too', () => {
		const verdict = laneRunVerdict({
			marks: [1, 2, 3, 4],
			violations: [
				kept({ segment: 1, seenAt: 'reset' }),
				kept({ segment: 3, seenAt: 'final', assessmentId: 'asmt-2' })
			]
		});
		expect(verdict).toContain('2 reasoning-review pass(es)');
		expect(verdict).toContain('segment 1');
		expect(verdict).toContain('segment 3');
	});
});

/**
 * The entries of `globalTeardown` in a Playwright config's `export default defineConfig({ … })`, read from its AST — or,
 * when the config is not that shape, WHY, so the guard fails CLOSED on a config it cannot read instead of passing on
 * one it did not.
 */
function globalTeardownEntries(source: string): string[] | string {
	const sf = ts.createSourceFile(
		'playwright.config.ts',
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const exported = sf.statements.find(ts.isExportAssignment);
	if (exported === undefined || exported.isExportEquals === true)
		return 'the config has no `export default`';
	const call = exported.expression;
	if (
		!ts.isCallExpression(call) ||
		!ts.isIdentifier(call.expression) ||
		call.expression.text !== 'defineConfig'
	)
		return 'the default export is not `defineConfig(…)`';
	const options = call.arguments[0];
	if (options === undefined || !ts.isObjectLiteralExpression(options))
		return '`defineConfig` is not given an object literal';
	if (options.properties.some(ts.isSpreadAssignment))
		return 'the options spread another object, which could set `globalTeardown` out of sight';
	const declared = options.properties.filter(
		(p) =>
			!ts.isSpreadAssignment(p) &&
			(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
			p.name.text === 'globalTeardown'
	);
	const only = declared[0];
	if (declared.length !== 1 || only === undefined || !ts.isPropertyAssignment(only))
		return `\`globalTeardown\` is not declared exactly once as a plain property (${declared.length} found)`;
	const value = only.initializer;
	const entries: string[] = [];
	for (const item of ts.isArrayLiteralExpression(value) ? value.elements : [value]) {
		if (!ts.isStringLiteralLike(item))
			return `an entry the AST cannot read as a path: ${item.getText(sf)}`;
		entries.push(item.text);
	}
	return entries;
}

describe('⛔ the verdict is WIRED — the default config calls the teardown (read from its AST)', () => {
	it('⛔ the DEFAULT config’s `globalTeardown` names `e2e/lane-control-teardown.ts` — the module driven below', () => {
		const entries = globalTeardownEntries(readFileSync(CONFIG, 'utf8'));
		if (typeof entries === 'string')
			throw new Error(
				`the default config’s globalTeardown cannot be read from its AST: ${entries}`
			);
		expect(
			entries.map((e) => resolve(APP, e)),
			'apps/rph-demo/playwright.config.ts does not run e2e/lane-control-teardown.ts — so what the server KEPT (a violation that passed on retry, a floor that completed after its test) never fails the run (REG-D-072 D8)'
		).toContain(TEARDOWN);
	});

	it('⭐ CONTROL — the AST read tells the forms apart, and fails CLOSED on a config it cannot read', () => {
		const cfg = (teardown: string) =>
			`import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './e2e', globalTeardown: ${teardown} });\n`;
		expect(
			globalTeardownEntries(cfg("['./e2e/global-teardown.ts', './e2e/lane-control-teardown.ts']"))
		).toEqual(['./e2e/global-teardown.ts', './e2e/lane-control-teardown.ts']);
		expect(globalTeardownEntries(cfg("'./e2e/global-teardown.ts'"))).toEqual([
			'./e2e/global-teardown.ts'
		]);
		for (const unreadable of [
			cfg('TEARDOWNS'),
			cfg("[...TEARDOWNS, './e2e/lane-control-teardown.ts']"),
			"export default defineConfig({ ...base, testDir: './e2e' });",
			"export default defineConfig({ testDir: './e2e' });",
			"export default { globalTeardown: './e2e/lane-control-teardown.ts' };"
		])
			expect(typeof globalTeardownEntries(unreadable), `read as a path list: ${unreadable}`).toBe(
				'string'
			);
	});
});

/** A stand-in for the rph-demo server's `/test-api/lane-control`: answers the teardown's final call with `report`, and
 *  records every request it receives, so a teardown that never asks cannot pass. */
async function laneControlStandIn(report: unknown) {
	const seen: { method: string | undefined; url: string | undefined; body: string }[] = [];
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on('data', (c: Buffer) => chunks.push(c));
		req.on('end', () => {
			seen.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8') });
			const ours = req.method === 'POST' && req.url === '/test-api/lane-control';
			res.writeHead(ours ? 200 : 404, { 'content-type': 'application/json' });
			res.end(JSON.stringify(ours ? report : { error: 'not the lane control route' }));
		});
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	const close = () =>
		new Promise<void>((r) => {
			server.closeAllConnections();
			server.close(() => r());
		});
	return { url, seen, close };
}

describe('⛔ the teardown’s DEFAULT EXPORT makes the final call and FAILS THE RUN on anything kept', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});
	/** Only what the default export reads from Playwright's config: the first project's `baseURL`. */
	const configAt = (baseURL: string) =>
		({ projects: [{ use: { baseURL } }] }) as unknown as FullConfig;
	const FINAL_CALL = [{ method: 'POST', url: '/test-api/lane-control', body: '{"final":true}' }];

	it('⛔ a report holding a violation — one a test saw, then passed on retry — makes it THROW the verdict', async () => {
		const lane = await laneControlStandIn({
			marks: [1, 2, 3],
			violations: [kept({ seenAt: 'after-test check', attributedTo: ['spec › flaky'] })]
		});
		try {
			await expect(laneControlTeardown(configAt(lane.url))).rejects.toThrow(
				'1 reasoning-review pass(es) the lane may not rest on, kept across 3 segment(s)'
			);
			expect(lane.seen, 'the teardown did not make the final call').toEqual(FINAL_CALL);
		} finally {
			await lane.close();
		}
	});

	it('⭐ CONTROL — a report holding none does not throw, and says what it checked', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const lane = await laneControlStandIn({ marks: [1, 2], violations: [] });
		try {
			await expect(laneControlTeardown(configAt(lane.url))).resolves.toBeUndefined();
			expect(lane.seen, 'the teardown did not make the final call').toEqual(FINAL_CALL);
			expect(log).toHaveBeenCalledWith('\n[lane control] 2 segment(s) checked; nothing kept.\n');
		} finally {
			await lane.close();
		}
	});
});
