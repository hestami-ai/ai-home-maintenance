import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS,
	codingAgentCliArtifactDigest,
	codingAgentCliArtifactReference,
	readCodingAgentCliJsonArtifact,
	publishCodingAgentCliJsonArtifact
} from './coding-agent-cli-artifact-store.js';
import { ContentAddressedCodingAgentCliArtifactStore } from './content-addressed-coding-agent-cli-artifact-store.js';
import {
	CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS,
	type ContentAddressedFileStoreFaultPoint
} from '../persistence/content-addressed-file-store.js';

const roots: string[] = [];

function storeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'jan-csaa-cli-artifacts-'));
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('content-addressed coding-agent CLI artifact store', () => {
	it('publishes separate bounded internal, transport, and retained-generation capacities', () => {
		expect(CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS).toEqual({
			maxInputBytes: 1024 * 1024,
			maxOutputBytes: 128 * 1024 * 1024,
			maxTransportBytes: 16 * 1024 * 1024
		});
		expect(CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxArtifactBytes).toBe(
			CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
		);
		expect(CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxTotalArtifactBytes).toBe(
			1024 * 1024 * 1024
		);
	});

	it('stages read-after-write bytes and withholds them after rollback', async () => {
		const root = storeRoot();
		const store = new ContentAddressedCodingAgentCliArtifactStore(root);
		store.begin();
		const published = await publishCodingAgentCliJsonArtifact(store, { value: 1 }, 1024);
		expect(await readCodingAgentCliJsonArtifact(store, published.reference, 1024)).toEqual({
			value: 1
		});
		store.rollback();
		const reopened = new ContentAddressedCodingAgentCliArtifactStore(root);
		await expect(
			readCodingAgentCliJsonArtifact(reopened, published.reference, 1024)
		).rejects.toMatchObject({
			code: 'ARTIFACT_NOT_FOUND'
		});
	});

	it('terminally refuses a late handler publication after rollback', async () => {
		const root = storeRoot();
		const store = new ContentAddressedCodingAgentCliArtifactStore(root);
		store.begin();
		store.rollback();

		await expect(
			publishCodingAgentCliJsonArtifact(store, { late: true }, 1024)
		).rejects.toMatchObject({ code: 'ARTIFACT_STORE_FAILED' });
		expect(() => store.begin()).toThrowError(
			expect.objectContaining({ code: 'ARTIFACT_STORE_FAILED' })
		);

		const freshInvocation = new ContentAddressedCodingAgentCliArtifactStore(root);
		freshInvocation.begin();
		const admitted = await publishCodingAgentCliJsonArtifact(freshInvocation, { next: true }, 1024);
		freshInvocation.commit();
		expect(await readCodingAgentCliJsonArtifact(freshInvocation, admitted.reference, 1024)).toEqual(
			{
				next: true
			}
		);
	});

	it('commits atomically and retains earlier immutable artifacts across process-like reopenings', async () => {
		const root = storeRoot();
		const first = new ContentAddressedCodingAgentCliArtifactStore(root);
		first.begin();
		const alpha = await publishCodingAgentCliJsonArtifact(first, { name: 'alpha' }, 1024);
		const beta = await publishCodingAgentCliJsonArtifact(first, { name: 'beta' }, 1024);
		first.commit();

		const second = new ContentAddressedCodingAgentCliArtifactStore(root);
		expect(await readCodingAgentCliJsonArtifact(second, alpha.reference, 1024)).toEqual({
			name: 'alpha'
		});
		second.begin();
		const gamma = await publishCodingAgentCliJsonArtifact(second, { name: 'gamma' }, 1024);
		second.commit();

		const third = new ContentAddressedCodingAgentCliArtifactStore(root);
		expect(await readCodingAgentCliJsonArtifact(third, beta.reference, 1024)).toEqual({
			name: 'beta'
		});
		expect(await readCodingAgentCliJsonArtifact(third, gamma.reference, 1024)).toEqual({
			name: 'gamma'
		});
	});

	it.each(['AFTER_POINTER_SWAP', 'AFTER_PUBLICATION_LOG'] as const)(
		'treats a %s exception as success only after exact durable-current verification',
		async (faultPoint) => {
			const root = storeRoot();
			let faultAt: ContentAddressedFileStoreFaultPoint | undefined = faultPoint;
			const store = new ContentAddressedCodingAgentCliArtifactStore(root, {
				fault(point) {
					if (point === faultAt) throw new Error(`fault:${point}`);
				}
			});
			store.begin();
			const artifact = await publishCodingAgentCliJsonArtifact(
				store,
				{ faultPoint, visibility: 'durable-current' },
				1024
			);

			expect(() => store.commit()).not.toThrow();
			faultAt = undefined;
			const reopened = new ContentAddressedCodingAgentCliArtifactStore(root);
			expect(await readCodingAgentCliJsonArtifact(reopened, artifact.reference, 1024)).toEqual({
				faultPoint,
				visibility: 'durable-current'
			});
		}
	);

	it('propagates a post-swap exception when fresh verification finds non-witness bytes', async () => {
		const root = storeRoot();
		let reference = '';
		const store = new ContentAddressedCodingAgentCliArtifactStore(root, {
			fault(point) {
				if (point !== 'AFTER_POINTER_SWAP') return;
				const digest = codingAgentCliArtifactDigest(reference);
				writeFileSync(join(root, 'artifacts', digest.slice(0, 2), `${digest}.blob`), 'corrupt');
				throw new Error('fault:AFTER_POINTER_SWAP');
			}
		});
		store.begin();
		const artifact = await publishCodingAgentCliJsonArtifact(
			store,
			{ visibility: 'corrupted-after-swap' },
			1024
		);
		reference = artifact.reference;

		expect(() => store.commit()).toThrow('fault:AFTER_POINTER_SWAP');
		store.rollback();
	});

	it.each([
		'AFTER_STAGING_CREATED',
		'AFTER_ARTIFACT_STAGED',
		'AFTER_GENERATION_STAGED',
		'AFTER_ARTIFACT_PUBLISHED',
		'AFTER_GENERATION_PUBLISHED',
		'BEFORE_POINTER_SWAP'
	] as const)('propagates a %s exception and publishes no current artifact', async (faultPoint) => {
		const root = storeRoot();
		const store = new ContentAddressedCodingAgentCliArtifactStore(root, {
			fault(point) {
				if (point === faultPoint) throw new Error(`fault:${point}`);
			}
		});
		store.begin();
		const artifact = await publishCodingAgentCliJsonArtifact(
			store,
			{ faultPoint, visibility: 'not-published' },
			1024
		);

		expect(() => store.commit()).toThrow(`fault:${faultPoint}`);
		store.rollback();
		expect(existsSync(join(root, 'current.json'))).toBe(false);
		const reopened = new ContentAddressedCodingAgentCliArtifactStore(root);
		await expect(
			readCodingAgentCliJsonArtifact(reopened, artifact.reference, 1024)
		).rejects.toMatchObject({ code: 'ARTIFACT_NOT_FOUND' });
	});

	it('merges independently staged writers without losing either content address', async () => {
		const root = storeRoot();
		const left = new ContentAddressedCodingAgentCliArtifactStore(root);
		const right = new ContentAddressedCodingAgentCliArtifactStore(root);
		left.begin();
		right.begin();
		const leftArtifact = await publishCodingAgentCliJsonArtifact(left, { side: 'left' }, 1024);
		const rightArtifact = await publishCodingAgentCliJsonArtifact(right, { side: 'right' }, 1024);
		left.commit();
		right.commit();

		const reopened = new ContentAddressedCodingAgentCliArtifactStore(root);
		expect(await readCodingAgentCliJsonArtifact(reopened, leftArtifact.reference, 1024)).toEqual({
			side: 'left'
		});
		expect(await readCodingAgentCliJsonArtifact(reopened, rightArtifact.reference, 1024)).toEqual({
			side: 'right'
		});
	});

	it('rejects bytes that do not match their declared content address', () => {
		const store = new ContentAddressedCodingAgentCliArtifactStore(storeRoot());
		const expected = codingAgentCliArtifactReference('expected');
		expect(() => store.write(expected, new TextEncoder().encode('different'))).toThrowError(
			expect.objectContaining({ code: 'ARTIFACT_DIGEST_MISMATCH' })
		);
	});

	it('refuses publication after host cancellation', async () => {
		const root = storeRoot();
		const controller = new AbortController();
		const store = new ContentAddressedCodingAgentCliArtifactStore(root);
		store.begin(controller.signal);
		const artifact = await publishCodingAgentCliJsonArtifact(store, { cancelled: true }, 1024);
		controller.abort();
		expect(() => store.commit()).toThrow();
		store.rollback();
		const reopened = new ContentAddressedCodingAgentCliArtifactStore(root);
		await expect(
			readCodingAgentCliJsonArtifact(reopened, artifact.reference, 1024)
		).rejects.toMatchObject({
			code: 'ARTIFACT_NOT_FOUND'
		});
	});
});
