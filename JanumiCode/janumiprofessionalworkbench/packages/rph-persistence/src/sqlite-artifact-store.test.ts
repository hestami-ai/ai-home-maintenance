// The DURABLE ArtifactStore must honour every invariant the in-memory default does — run from one source.
//
// ⭑ THE SUITE IS SHARED, NOT COPIED. REG-F-337's PER-8 hard-delete vector lived in the KEY DERIVATION, so a
// second adapter can reproduce it independently; a duplicated suite would drift until one of them does.
import { artifactStoreContract } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteArtifactStore } from './sqlite-artifact-store.js';

describe('SqliteArtifactStore — the ArtifactStore contract', () => {
	artifactStoreContract(() => new SqliteArtifactStore());
});

describe('SqliteArtifactStore — what makes it DURABLE', () => {
	it('declares DURABLE, which is what a record copies onto every stored ref', () => {
		// REG-F-342: a durable RECORD naming process-local CONTENT is the inverse orphan, and it is lawful only
		// if the record says so. This declaration is what the record reads.
		expect(new SqliteArtifactStore().durability).toBe('DURABLE');
	});

	it('the bytes SURVIVE a reopen — the property the in-memory default cannot have', async () => {
		const file = join(mkdtempSync(join(tmpdir(), 'mxr-store-')), 'content.sqlite');
		const first = new SqliteArtifactStore({ filename: file });
		const ref = await first.put({
			tenantPrefix: 'tnt-1',
			bytes: 'JUDGE THIS GRAPH',
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		first.close();

		// THE MUTANT: an in-memory driver. Every contract assertion above still passes and this one fails,
		// which is precisely the gap H-2 described — a durable record naming content a restart erased.
		const reopened = new SqliteArtifactStore({ filename: file });
		expect(await reopened.get(ref.storageKey), 'the bytes did not survive the process').toBe(
			'JUDGE THIS GRAPH'
		);
		expect((await reopened.stat(ref.storageKey))?.contentHash).toBe(ref.contentHash);
		reopened.close();
	});

	it('and a TOMBSTONE survives too, so an absent row means never-written and says so', async () => {
		// ⭑ THIS IS WHAT THE PROCESS-LOCAL STORE COULD NOT CLAIM. Its refusal had to say it cannot distinguish
		// "never stored" from "lost at restart"; this one can, because purged rows persist.
		const file = join(mkdtempSync(join(tmpdir(), 'mxr-tomb-')), 'content.sqlite');
		const first = new SqliteArtifactStore({ filename: file });
		const ref = await first.put({
			tenantPrefix: 'tnt-1',
			bytes: 'volunteered reasoning',
			mediaType: 'text/plain',
			purgeability: 'PURGEABLE_AT_EXPIRY'
		});
		expect((await first.purge(ref.storageKey)).purged).toBe(true);
		first.close();

		const reopened = new SqliteArtifactStore({ filename: file });
		const meta = await reopened.stat(ref.storageKey);
		expect(meta?.purged, 'the tombstone did not survive').toBe(true);
		expect(await reopened.get(ref.storageKey), 'purged means the bytes are gone').toBeUndefined();

		const absent = await reopened.purge('tnt-1/PURGEABLE_AT_EXPIRY/never-written');
		expect(absent.purged).toBe(false);
		expect(
			absent.purged === false && absent.refusedBecause,
			'a durable store can say never-written and mean it'
		).toMatch(/never written/i);
		reopened.close();
	});
});
