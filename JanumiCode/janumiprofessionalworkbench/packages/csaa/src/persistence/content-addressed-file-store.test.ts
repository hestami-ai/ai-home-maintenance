import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	utimesSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	ContentAddressedFileStore,
	ContentAddressedStoreBusyError,
	ContentAddressedStoreCancelledError,
	ContentAddressedStoreValidationError,
	type ContentAddressedArtifactDefinition,
	type ContentAddressedFileStoreFaultPoint,
	type ContentAddressedInvalidationInput,
	type ContentAddressedPublishRequest
} from './content-addressed-file-store.js';

const temporaryRoots: string[] = [];

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function temporaryStoreRoot(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-content-store-'));
	temporaryRoots.push(root);
	return root;
}

function digest(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function input(
	key: string,
	value: string,
	kind: ContentAddressedInvalidationInput['kind'] = 'FILE_CONTENT'
): ContentAddressedInvalidationInput {
	return { key, kind, digest: digest(value) };
}

function output(
	logicalKey: string,
	dependencyKeys: readonly string[],
	compute: ContentAddressedArtifactDefinition['compute'],
	transformVersion = 'transform@1'
): ContentAddressedArtifactDefinition {
	return {
		logicalKey,
		artifactKind: 'TEST_ARTIFACT',
		transformVersion,
		dependencyKeys,
		compute
	};
}

function request(
	mode: ContentAddressedPublishRequest['mode'],
	expectedCurrentGenerationId: string | null,
	invalidationInputs: readonly ContentAddressedInvalidationInput[],
	outputs: readonly ContentAddressedArtifactDefinition[],
	overrides: Partial<Pick<ContentAddressedPublishRequest, 'verifyCleanEquivalence' | 'signal'>> = {}
): ContentAddressedPublishRequest {
	return {
		mode,
		expectedCurrentGenerationId,
		subjectId: 'subject:test',
		invalidationInputs,
		outputs,
		verifyCleanEquivalence: overrides.verifyCleanEquivalence ?? false,
		...(overrides.signal === undefined ? {} : { signal: overrides.signal })
	};
}

function currentText(store: ContentAddressedFileStore, logicalKey = 'artifact:a'): string | null {
	const view = store.openCurrentReadView();
	if (view === null) return null;
	try {
		return new TextDecoder().decode(view.readArtifact(logicalKey));
	} finally {
		view.close();
	}
}

describe('ContentAddressedFileStore', () => {
	it('publishes immutable generations, reuses only exact dependency identities, and matches clean output', () => {
		const root = temporaryStoreRoot();
		const store = new ContentAddressedFileStore(root);
		expect(store.initialize()).toMatchObject({
			rebuildRequired: false,
			reason: 'EMPTY_STORE_INITIALIZED',
			currentGenerationId: null
		});
		const counts = { a: 0, config: 0, fanout: 0 };
		const definitions = (): readonly ContentAddressedArtifactDefinition[] => [
			output('artifact:a', ['file:a'], ({ invalidationInputs }) => {
				counts.a += 1;
				return `a:${invalidationInputs[0]!.digest}`;
			}),
			output('artifact:config', ['config'], ({ invalidationInputs }) => {
				counts.config += 1;
				return `config:${invalidationInputs[0]!.digest}`;
			}),
			output('artifact:fanout', ['config', 'file:a'], ({ invalidationInputs }) => {
				counts.fanout += 1;
				return canonicalSemanticJson(invalidationInputs);
			})
		];
		const initialInputs = [input('file:a', 'one'), input('config', 'one', 'PARSED_CONFIGURATION')];
		const clean = store.publish(request('CLEAN', null, initialInputs, definitions()));
		expect(clean).toMatchObject({ computedArtifacts: 3, reusedArtifacts: 0 });
		expect(counts).toEqual({ a: 1, config: 1, fanout: 1 });

		const unchanged = store.publish(
			request('INCREMENTAL', clean.generationId, initialInputs, definitions(), {
				verifyCleanEquivalence: true
			})
		);
		expect(unchanged.generationId).toBe(clean.generationId);
		expect(unchanged).toMatchObject({
			computedArtifacts: 0,
			reusedArtifacts: 3,
			cleanEquivalenceVerified: true
		});
		// Qualification computes a clean control, but no artifact is classified as incrementally computed.
		expect(counts).toEqual({ a: 2, config: 2, fanout: 2 });

		const changedInputs = [input('file:a', 'one'), input('config', 'two', 'PARSED_CONFIGURATION')];
		expect(store.planInvalidation(changedInputs)).toEqual({
			changedKeys: ['config'],
			affectedArtifacts: ['artifact:config', 'artifact:fanout'],
			reusableArtifacts: ['artifact:a']
		});
		const incremental = store.publish(
			request('INCREMENTAL', unchanged.generationId, changedInputs, definitions(), {
				verifyCleanEquivalence: true
			})
		);
		expect(incremental).toMatchObject({ computedArtifacts: 2, reusedArtifacts: 1 });

		const cleanControl = store.publish(
			request('CLEAN', incremental.generationId, changedInputs, definitions())
		);
		expect(cleanControl.generationId).toBe(incremental.generationId);
		expect(cleanControl.artifacts).toEqual(incremental.artifacts);
		expect(currentText(store)).toBe(`a:${digest('one')}`);

		const changedSubject = store.publish({
			...request('INCREMENTAL', cleanControl.generationId, changedInputs, definitions()),
			subjectId: 'subject:other'
		});
		expect(changedSubject).toMatchObject({ computedArtifacts: 3, reusedArtifacts: 0 });
		expect(changedSubject.generationId).not.toBe(cleanControl.generationId);
	});

	it('fences writers while an immutable reader remains usable and retention honors its pin', () => {
		const root = temporaryStoreRoot();
		let nestedChecked = false;
		let readerTextDuringWrite: string | undefined;
		const faultState: {
			request?: ContentAddressedPublishRequest;
			reader?: NonNullable<ReturnType<ContentAddressedFileStore['openCurrentReadView']>>;
		} = {};
		const store = new ContentAddressedFileStore(root, {
			fault(point) {
				if (point !== 'BEFORE_POINTER_SWAP' || faultState.request === undefined || nestedChecked)
					return;
				nestedChecked = true;
				expect(() => store.publish(faultState.request!)).toThrow(ContentAddressedStoreBusyError);
				readerTextDuringWrite = new TextDecoder().decode(
					faultState.reader!.readArtifact('artifact:a')
				);
			}
		});
		store.initialize();
		const definition = (text: string): ContentAddressedArtifactDefinition =>
			output('artifact:a', ['file:a'], () => text);
		const first = store.publish(
			request('CLEAN', null, [input('file:a', 'one')], [definition('old')])
		);
		const reader = store.openCurrentReadView();
		expect(reader).not.toBeNull();
		faultState.reader = reader!;
		faultState.request = request(
			'INCREMENTAL',
			first.generationId,
			[input('file:a', 'two')],
			[definition('nested')]
		);
		const second = store.publish(
			request('INCREMENTAL', first.generationId, [input('file:a', 'two')], [definition('new')])
		);
		expect(nestedChecked).toBe(true);
		expect(readerTextDuringWrite).toBe('old');
		expect(currentText(store)).toBe('new');

		store.retain({ keepPublishedGenerations: 0 });
		expect(readdirSync(join(root, 'generations')).sort()).toEqual(
			[first.generationId, second.generationId].sort()
		);
		reader!.close();
		store.retain({ keepPublishedGenerations: 0 });
		expect(readdirSync(join(root, 'generations'))).toEqual([second.generationId]);
	});

	it('never publishes pre-linearization cancellation or faults and recovers a post-swap crash', () => {
		const root = temporaryStoreRoot();
		let faultAt: ContentAddressedFileStoreFaultPoint | undefined;
		const faultState: { lateAbort?: AbortController } = {};
		const store = new ContentAddressedFileStore(root, {
			fault(point) {
				if (point === 'AFTER_POINTER_SWAP' && faultState.lateAbort !== undefined) {
					faultState.lateAbort.abort();
					return;
				}
				if (point === faultAt) throw new Error(`fault:${point}`);
			}
		});
		store.initialize();
		const first = store.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'old')]
			)
		);

		const controller = new AbortController();
		expect(() =>
			store.publish(
				request(
					'INCREMENTAL',
					first.generationId,
					[input('file:a', 'cancel')],
					[
						output('artifact:a', ['file:a'], () => {
							controller.abort();
							return 'cancelled';
						})
					],
					{ signal: controller.signal }
				)
			)
		).toThrow(ContentAddressedStoreCancelledError);
		expect(currentText(store)).toBe('old');

		const prePublicationFaults: readonly ContentAddressedFileStoreFaultPoint[] = [
			'AFTER_STAGING_CREATED',
			'AFTER_ARTIFACT_STAGED',
			'AFTER_GENERATION_STAGED',
			'AFTER_ARTIFACT_PUBLISHED',
			'AFTER_GENERATION_PUBLISHED',
			'BEFORE_POINTER_SWAP'
		];
		for (const point of prePublicationFaults) {
			faultAt = point;
			expect(() =>
				store.publish(
					request(
						'INCREMENTAL',
						first.generationId,
						[input('file:a', point)],
						[output('artifact:a', ['file:a'], () => point)]
					)
				)
			).toThrow(`fault:${point}`);
			faultAt = undefined;
			expect(store.initialize()).toMatchObject({
				rebuildRequired: false,
				currentGenerationId: first.generationId
			});
			expect(currentText(store)).toBe('old');
			expect(readdirSync(join(root, 'staging'))).toEqual([]);
		}

		faultAt = 'AFTER_POINTER_SWAP';
		expect(() =>
			store.publish(
				request(
					'INCREMENTAL',
					first.generationId,
					[input('file:a', 'after')],
					[output('artifact:a', ['file:a'], () => 'after')]
				)
			)
		).toThrow('fault:AFTER_POINTER_SWAP');
		faultAt = undefined;
		expect(currentText(store)).toBe('after');
		const recovered = store.initialize();
		expect(recovered).toMatchObject({ rebuildRequired: false, reason: 'NONE' });
		expect(readdirSync(join(root, 'publications'))).toHaveLength(2);

		const current = store.openCurrentReadView()!;
		const currentId = current.generationId;
		current.close();
		faultState.lateAbort = new AbortController();
		const late = store.publish(
			request(
				'INCREMENTAL',
				currentId,
				[input('file:a', 'late')],
				[output('artifact:a', ['file:a'], () => 'late')],
				{ signal: faultState.lateAbort.signal }
			)
		);
		expect(faultState.lateAbort.signal.aborted).toBe(true);
		expect(late.generationId).not.toBe(currentId);
		expect(currentText(store)).toBe('late');

		faultState.lateAbort = undefined;
		faultAt = 'AFTER_PUBLICATION_LOG';
		expect(() =>
			store.publish(
				request(
					'INCREMENTAL',
					late.generationId,
					[input('file:a', 'logged')],
					[output('artifact:a', ['file:a'], () => 'logged')]
				)
			)
		).toThrow('fault:AFTER_PUBLICATION_LOG');
		faultAt = undefined;
		expect(currentText(store)).toBe('logged');
		expect(store.initialize()).toMatchObject({ rebuildRequired: false, reason: 'NONE' });
	});

	it('fails closed on hostile inputs and enforces artifact resource budgets before staging', () => {
		const root = temporaryStoreRoot();
		const store = new ContentAddressedFileStore(root, {
			maxArtifactBytes: 8,
			maxTotalArtifactBytes: 12
		});
		store.initialize();
		let getterExecuted = false;
		const hostile = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(hostile, 'mode', {
			enumerable: true,
			get() {
				getterExecuted = true;
				return 'CLEAN';
			}
		});
		for (const [key, value] of Object.entries({
			expectedCurrentGenerationId: null,
			subjectId: 'subject:test',
			invalidationInputs: [],
			outputs: [],
			verifyCleanEquivalence: false
		}))
			Object.defineProperty(hostile, key, { enumerable: true, value });
		expect(() => store.publish(hostile as unknown as ContentAddressedPublishRequest)).toThrow(
			ContentAddressedStoreValidationError
		);
		expect(getterExecuted).toBe(false);
		expect(() =>
			store.publish(new Proxy(hostile, {}) as unknown as ContentAddressedPublishRequest)
		).toThrow(ContentAddressedStoreValidationError);

		expect(() =>
			store.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[
						output('artifact:a', ['file:a'], () => '12345678'),
						output('artifact:b', ['file:a'], () => 'abcdefgh')
					]
				)
			)
		).toThrow('total byte budget');
		expect(readdirSync(join(root, 'staging'))).toEqual([]);
		expect(store.openCurrentReadView()).toBeNull();
	});

	it('rebuilds corrupt and unknown-version state and safely replaces a corrupt content address', () => {
		const root = temporaryStoreRoot();
		const store = new ContentAddressedFileStore(root);
		store.initialize();
		const published = store.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		const reference = published.artifacts[0]!;
		const artifactPath = join(
			root,
			'artifacts',
			reference.sha256.slice(0, 2),
			`${reference.sha256}.blob`
		);
		writeFileSync(artifactPath, 'wrong');
		expect(store.initialize()).toMatchObject({
			rebuildRequired: true,
			reason: 'CORRUPT_CURRENT_GENERATION',
			currentGenerationId: null
		});
		const repaired = store.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		expect(currentText(store)).toBe('value');
		expect(readFileSync(artifactPath, 'utf8')).toBe('value');
		expect(repaired.generationId).toBe(published.generationId);
		writeFileSync(join(root, 'publications', '0000000000009999.json'), Uint8Array.from([0xff]));
		expect(store.initialize()).toMatchObject({
			rebuildRequired: false,
			currentGenerationId: repaired.generationId
		});

		writeFileSync(
			join(root, 'format.json'),
			canonicalSemanticJson({
				schema: 'JAN-CSAA-CONTENT-ADDRESSED-FILE-STORE@2',
				hashAlgorithm: 'SHA-256'
			})
		);
		expect(store.initialize()).toMatchObject({
			rebuildRequired: true,
			reason: 'UNKNOWN_FORMAT_VERSION',
			currentGenerationId: null
		});
		expect(store.openCurrentReadView()).toBeNull();

		writeFileSync(join(root, '.writer.lock'), Uint8Array.from([0xff]));
		expect(() => store.initialize()).toThrow(ContentAddressedStoreBusyError);
		const old = new Date(Date.now() - 60_000);
		utimesSync(join(root, '.writer.lock'), old, old);
		const staleRecoveringStore = new ContentAddressedFileStore(root, {
			lockStaleAfterMs: 1,
			now: () => Date.now() + 60_000,
			isProcessAlive: () => false
		});
		expect(staleRecoveringStore.initialize()).toMatchObject({ rebuildRequired: false });
		expect(existsSync(join(root, '.writer.lock'))).toBe(false);
	});

	it('matches clean reconstruction through deterministic randomized edits, deletion, rename, and fan-out', () => {
		const root = temporaryStoreRoot();
		const store = new ContentAddressedFileStore(root);
		store.initialize();
		let randomState = 0x51aa_2026;
		const random = (): number => {
			randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
			return randomState;
		};
		const values = Array.from({ length: 8 }, (_, index) => `initial-${index}`);
		let expected: string | null = null;
		for (let iteration = 0; iteration < 24; iteration += 1) {
			values[random() % values.length] = `value-${iteration}-${random()}`;
			const inputs = values.map((value, index) => input(`file:${index}`, value));
			const outputCount = 5 + (random() % 8);
			const definitions = Array.from({ length: outputCount }, (_, index) => {
				const first = (index + iteration) % inputs.length;
				const second = (index * 3 + 1) % inputs.length;
				const keys = first === second ? [`file:${first}`] : [`file:${first}`, `file:${second}`];
				return output(
					`artifact:${iteration % 3 === 0 && index === 0 ? `renamed-${iteration}` : index}`,
					keys,
					({ logicalKey, invalidationInputs }) =>
						canonicalSemanticJson({ logicalKey, invalidationInputs }),
					`transform@${iteration % 5 === 0 && index === 1 ? 2 : 1}`
				);
			});
			const incremental = store.publish(
				request(expected === null ? 'CLEAN' : 'INCREMENTAL', expected, inputs, definitions, {
					verifyCleanEquivalence: expected !== null
				})
			);
			const clean = store.publish(request('CLEAN', incremental.generationId, inputs, definitions));
			expect(clean.generationId).toBe(incremental.generationId);
			expect(clean.artifacts).toEqual(incremental.artifacts);
			expected = clean.generationId;
		}
	});
});
