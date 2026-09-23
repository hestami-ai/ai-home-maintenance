// ⛔ AN ENGINE THAT ADMITS TEST-STIPULATED ANSWERS IS NEVER DURABLE — the engine's guarantee (`JAN-CRITREAD`
// J1-1b; `REG-D-071` Q5 (b), `REG-D-072` D1).
//
// In an engine built for tests, a stipulated answer — a CLEAN answer the test itself stated for a reasoning-review
// criterion nobody judged — counts as given (J1-1c). That is lawful only because such an engine's records die
// with its process. So the `Engine` itself refuses the flag over any store that does not report itself
// `NOT_DURABLE`: in its CONSTRUCTOR, because `Engine` is public and is built directly at well over a hundred
// sites, and a lock in `createEngine` alone would bind only the callers that happened to use the factory.
//
// ⚠ WHAT THIS DOES NOT GUARANTEE, stated rather than implied: that an admitting engine is a TEST engine. The
// demo's ordinary boot and every vitest engine are in memory too. That is the host's fact
// (`workbench-admits-stipulations.test.ts`).
import { Engine } from '@janumipwb/rph-application';
import {
	createSqliteDriver,
	SnapshotOverlayStorageAdapter,
	SqliteStorageAdapter
} from '@janumipwb/rph-persistence';
import type { StorageAdapter } from '@janumipwb/rph-ports';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEngine } from './index.js';

let dir = '';
const opened: { close(): void }[] = [];
const keep = <T extends { close(): void }>(s: T): T => {
	opened.push(s);
	return s;
};
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'rph-admit-'));
});
afterEach(() => {
	for (const s of opened.splice(0)) s.close();
	try {
		rmSync(dir, { recursive: true, force: true });
	} catch {
		/* Windows holds open files; the temp directory is the backstop */
	}
});

const fileStore = (name: string) => keep(new SqliteStorageAdapter({ filename: join(dir, name) }));
const deps = (store?: StorageAdapter) => ({
	authenticate: testAuthenticator(),
	ontology,
	...(store ? { store } : {}),
	admitStipulatedAnswers: true
});
const REFUSAL = /admitStipulatedAnswers needs a store that reports itself NOT_DURABLE, and this one reports DURABLE/;

describe('⛔ the Engine refuses to admit test-stipulated answers over a durable store', () => {
	it('⛔ over a file store — through createEngine, and through `new Engine` directly', () => {
		// PREDICTED RED BEFORE J1-1b's refusal: both build. THE MUTANT: delete the refusal.
		expect(() => createEngine(deps(fileStore('a.db')))).toThrow(REFUSAL);
		expect(() => new Engine({ store: fileStore('b.db'), authenticate: testAuthenticator(), admitStipulatedAnswers: true })).toThrow(REFUSAL);
	});

	it('⛔ over a FORK of a durable store — its writes are committed back into it', () => {
		const overlay = new SnapshotOverlayStorageAdapter(fileStore('c.db'));
		expect(() => new Engine({ store: overlay, authenticate: testAuthenticator(), admitStipulatedAnswers: true })).toThrow(
			REFUSAL
		);
	});

	it('⛔ over a file store whose DRIVER was injected — the constructor never saw a filename', () => {
		const injected = keep(new SqliteStorageAdapter({ driver: createSqliteDriver(join(dir, 'd.db')) }));
		expect(() => createEngine(deps(injected))).toThrow(REFUSAL);
	});

	it('⛔ over a store that cannot say — UNKNOWN counts as durable', () => {
		// THE MUTANT: admit unless the store says DURABLE. An adapter that cannot tell would then admit.
		const memory = keep(new SqliteStorageAdapter());
		const unknown = new Proxy(memory, {
			get: (t, k) => (k === 'durability' ? 'UNKNOWN' : Reflect.get(t, k, t))
		}) as StorageAdapter;
		expect(() => createEngine(deps(unknown))).toThrow(/this one reports UNKNOWN/);
	});

	it('⭐ CONTROL — an in-memory engine admits, and says so', () => {
		// Without this, every refusal above is satisfied by "never admit at all".
		const handle = createEngine(deps());
		opened.push(handle);
		expect(handle.admitStipulatedAnswers).toBe(true);
	});

	it('⛔ the flag reaches a FORK as it reaches the parent — an authoring turn records into its fork', () => {
		// THE MUTANT: an override inside `fork()`'s spread. The parent would admit while every turn's fork refused,
		// and the parent and fork could disagree about the same floor — which is the one way the two diverge, since
		// a field left out of `createEngine`'s enumeration reaches neither (`REG-D-072`).
		const handle = createEngine(deps());
		opened.push(handle);
		expect(handle.fork().admitStipulatedAnswers).toBe(true);
		expect(handle.as(TEST_CRED.human).fork().admitStipulatedAnswers, 'and a session’s fork').toBe(true);
	});

	it('⭐ an engine built without the flag does not admit — absent is the refusing value', () => {
		const handle = createEngine({ authenticate: testAuthenticator(), ontology });
		opened.push(handle);
		expect(handle.admitStipulatedAnswers).toBe(false);
		expect(handle.fork().admitStipulatedAnswers).toBe(false);
	});
});
