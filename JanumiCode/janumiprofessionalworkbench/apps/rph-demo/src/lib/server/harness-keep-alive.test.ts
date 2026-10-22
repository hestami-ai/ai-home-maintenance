// ⭐ `REG-F-501` — THE HARNESS'S KEEP-ALIVE PLUGIN: WHAT IT CHANGES, WHERE, AND THAT `vite.config.ts` CARRIES IT.
//
// `harness-keep-alive-connection.test.ts` drives the reset and its remedy over a real connection. This file holds the
// plugin to its mode: in harness mode it raises `keepAliveTimeout` and nothing else; outside it, a dev server keeps
// Node's defaults; it asks `harnessExposed()`'s question; and the app's Vite config carries it.
//
// ⚠ `@sveltejs/kit/vite` IS STOOD IN FOR, so `vite.config.ts` can be imported here: its `sveltekit()` loads a SvelteKit
// config from the working directory when called, and this file reads only the plugin list.
import { createServer, type Server } from 'node:http';
import type { Plugin, PluginOption } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	HARNESS_KEEP_ALIVE_TIMEOUT_MS,
	harnessDeclared,
	harnessKeepAlive
} from './harness-keep-alive.js';

vi.mock('@sveltejs/kit/vite', () => ({ sveltekit: () => [] }));

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

/** The four timeouts Node gives a server, read from it. */
function timeoutsOf(server: Server) {
	return {
		keepAliveTimeout: server.keepAliveTimeout,
		keepAliveTimeoutBuffer: server.keepAliveTimeoutBuffer,
		headersTimeout: server.headersTimeout,
		requestTimeout: server.requestTimeout
	};
}

/** The plugin's `configureServer`, called as Vite calls it, with a stand-in dev server carrying `httpServer` alone. */
function configure(plugin: Plugin, httpServer: Server | null): void {
	const hook = plugin.configureServer;
	if (typeof hook !== 'function') throw new Error(`${plugin.name} has no configureServer function`);
	void hook.call({} as never, { httpServer } as never);
}

/** The plugins a Vite config lists, its nested lists flattened. */
function pluginsOf(options: readonly PluginOption[]): Plugin[] {
	return options.flatMap((o): Plugin[] => {
		if (Array.isArray(o)) return pluginsOf(o);
		return o && typeof o === 'object' && 'name' in o ? [o] : [];
	});
}

/** The declarations `harnessExposed()` is asked under: each limb alone, both, neither, and words that are not yes. */
const DECLARATIONS: readonly (readonly [mode: string, harness: string])[] = [
	['test', ''],
	['test', '1'],
	['server', '1'],
	['', '1'],
	['server', ''],
	['', ''],
	['', '0'],
	['server', 'true']
];

describe('⭐ REG-F-501 — the harness keep-alive plugin', () => {
	it('⭐ in harness mode it raises keepAliveTimeout, and nothing else: test mode and the execution lane’s declaration alike', () => {
		for (const env of [{ RPH_DEMO_MODE: 'test' }, { RPH_DEMO_MODE: 'server', JPWB_HARNESS: '1' }]) {
			const httpServer = createServer();
			configure(harnessKeepAlive(env), httpServer);
			expect(timeoutsOf(httpServer), `a dev server declaring ${JSON.stringify(env)}`).toEqual({
				...timeoutsOf(createServer()),
				keepAliveTimeout: HARNESS_KEEP_ALIVE_TIMEOUT_MS
			});
		}
	});

	it('⭐ and the timer Node arms for an idle connection sits at Node’s timer ceiling, not past it', () => {
		const httpServer = createServer();
		configure(harnessKeepAlive({ RPH_DEMO_MODE: 'test' }), httpServer);
		expect(
			httpServer.keepAliveTimeout + httpServer.keepAliveTimeoutBuffer,
			'past 2 ** 31 - 1 ms Node cuts the timer to it, with a TimeoutOverflowWarning on every response'
		).toBe(2 ** 31 - 1);
	});

	it('⛔ CONTROL — outside harness mode a dev server keeps Node’s defaults', () => {
		expect(
			timeoutsOf(createServer()),
			'Node’s defaults: the 5,000 + 1,000 ms close harness-keep-alive.ts states, and the request timeouts it leaves'
		).toEqual({
			keepAliveTimeout: 5_000,
			keepAliveTimeoutBuffer: 1_000,
			headersTimeout: 60_000,
			requestTimeout: 300_000
		});
		for (const env of [
			{},
			{ RPH_DEMO_MODE: 'server' },
			{ RPH_DEMO_MODE: 'server', JPWB_HARNESS: '0' },
			{ JPWB_HARNESS: 'true' },
			{ RPH_DEMO_MODE: 'dev' }
		]) {
			const httpServer = createServer();
			configure(harnessKeepAlive(env), httpServer);
			expect(timeoutsOf(httpServer), `a dev server declaring ${JSON.stringify(env)}`).toEqual(
				timeoutsOf(createServer())
			);
		}
	});

	it('⭐ it asks the server’s own question: harnessDeclared answers as harnessExposed() does, declaration by declaration', async () => {
		for (const [mode, harness] of DECLARATIONS) {
			vi.resetModules();
			vi.stubEnv('RPH_DEMO_MODE', mode);
			vi.stubEnv('JPWB_HARNESS', harness);
			vi.stubEnv('JPWB_DEMO_DB', '');
			const { harnessExposed } = await import('./workbench.js');
			expect(
				harnessDeclared(process.env),
				`RPH_DEMO_MODE='${mode}' JPWB_HARNESS='${harness}'`
			).toBe(harnessExposed());
		}
	});

	it('⭐ the app’s Vite config carries it, and there it applies in harness mode', async () => {
		const { default: config } = await import('../../../vite.config.js');
		const plugin = pluginsOf(config.plugins ?? []).find(
			(p) => p.name === 'jpwb-harness-keep-alive'
		);
		expect(
			plugin,
			'vite.config.ts carries no harness keep-alive plugin, so the harness’s dev server closes an idle connection after ' +
				'Node’s 6 s (REG-F-501)'
		).toBeDefined();
		vi.stubEnv('RPH_DEMO_MODE', 'test');
		const httpServer = createServer();
		configure(plugin!, httpServer);
		expect(httpServer.keepAliveTimeout).toBe(HARNESS_KEEP_ALIVE_TIMEOUT_MS);
	});
});
