import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
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
import {
	canonicalSemanticJson,
	canonicalSemanticJsonPrefixedSha256
} from '../semantic/canonical.js';
import {
	CONTENT_ADDRESSED_FILE_STORE_SCHEMAS,
	ContentAddressedFileStore,
	ContentAddressedStoreBusyError,
	ContentAddressedStoreCancelledError,
	ContentAddressedStoreConflictError,
	ContentAddressedStoreCorruptionError,
	ContentAddressedStoreEquivalenceError,
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

function writeCanonical(path: string, value: unknown): void {
	writeFileSync(path, canonicalSemanticJson(value));
}

function readRecord(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function publicationFileName(value: number): string {
	return `${String(value).padStart(16, '0')}.json`;
}

function publicationFromPointer(pointer: Record<string, unknown>): Record<string, unknown> {
	return {
		generationId: pointer.generationId,
		manifestSha256: pointer.manifestSha256,
		publicationGeneration: pointer.publicationGeneration,
		schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.publication
	};
}

function writePointer(
	root: string,
	generationId: unknown,
	manifestSha256: unknown,
	publicationGeneration: number
): void {
	const body = {
		generationId,
		manifestSha256,
		publicationGeneration,
		schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.pointer
	};
	writeCanonical(join(root, 'current.json'), {
		...body,
		pointerSha256: canonicalSemanticJsonPrefixedSha256(
			'JAN-CSAA-CONTENT-ADDRESSED-CURRENT-POINTER\0',
			body
		)
	});
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

	it('rejects every malformed request and constructor option before filesystem observation', () => {
		const root = temporaryStoreRoot();
		const store = new ContentAddressedFileStore(root);
		const valid = (): ContentAddressedPublishRequest =>
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			);
		const expandedInputs = [input('file:a', 'one')];
		Object.defineProperty(expandedInputs, 'named', { enumerable: true, value: true });
		const symbolInput = { ...input('file:a', 'one') };
		Object.defineProperty(symbolInput, Symbol('extra'), { enumerable: true, value: true });
		const customInput = { ...input('file:a', 'one') };
		Object.setPrototypeOf(customInput, { custom: true });
		const signalAccessor = valid() as unknown as Record<string, unknown>;
		Object.defineProperty(signalAccessor, 'signal', {
			enumerable: true,
			get: () => new AbortController().signal
		});
		const invalidRequests: readonly unknown[] = [
			null,
			new Date(),
			{ ...valid(), extra: true },
			{ ...valid(), mode: 'REPAIR' },
			{ ...valid(), expectedCurrentGenerationId: 'invalid' },
			{ ...valid(), subjectId: '' },
			{ ...valid(), invalidationInputs: null },
			{ ...valid(), invalidationInputs: new Proxy([], {}) },
			{ ...valid(), invalidationInputs: new Array(1) },
			{ ...valid(), invalidationInputs: expandedInputs },
			{ ...valid(), invalidationInputs: new Array(4_097) },
			{ ...valid(), invalidationInputs: [symbolInput] },
			{ ...valid(), invalidationInputs: [{ ...input('file:a', 'one'), extra: true }] },
			{ ...valid(), invalidationInputs: [customInput] },
			{ ...valid(), invalidationInputs: [new Date()] },
			{
				...valid(),
				invalidationInputs: [{ ...input('file:a', 'one'), kind: 'UNSUPPORTED' }]
			},
			{
				...valid(),
				invalidationInputs: [input('file:a', 'one'), input('file:a', 'two')]
			},
			{
				...valid(),
				outputs: [output('artifact:a', ['missing'], () => 'value')]
			},
			{
				...valid(),
				outputs: [output('artifact:a', ['file:a', 'file:a'], () => 'value')]
			},
			{
				...valid(),
				outputs: [{ ...output('artifact:a', ['file:a'], () => 'value'), compute: 1 }]
			},
			{
				...valid(),
				outputs: [
					output('artifact:a', ['file:a'], () => 'one'),
					output('artifact:a', ['file:a'], () => 'two')
				]
			},
			{ ...valid(), verifyCleanEquivalence: 'yes' },
			{ ...valid(), signal: {} },
			signalAccessor
		];
		for (const candidate of invalidRequests)
			expect(() => store.publish(candidate as ContentAddressedPublishRequest)).toThrow(
				ContentAddressedStoreValidationError
			);

		const inputs = Array.from({ length: 4_096 }, (_, index) =>
			input(`file:${index}`, String(index))
		);
		const keys = inputs.map((entry) => entry.key);
		const outputs = Array.from({ length: 5 }, (_, index) =>
			output(`artifact:${index}`, index === 4 ? [keys[0]!] : keys, () => 'x')
		);
		expect(() => store.publish(request('CLEAN', null, inputs, outputs))).toThrow(
			/aggregate dependency-reference budget/u
		);

		const invalidOptions: readonly unknown[] = [
			{ extra: true },
			{ now: 1 },
			{ maxArtifacts: 0 },
			{ maxArtifactBytes: 8, maxTotalArtifactBytes: 7 }
		];
		for (const options of invalidOptions)
			expect(() => new ContentAddressedFileStore(root, options as never)).toThrow(
				ContentAddressedStoreValidationError
			);
	});

	it('exposes conflict, equivalence, reader, compute, and metadata failure contracts', () => {
		const empty = new ContentAddressedFileStore(temporaryStoreRoot());
		expect(empty.planInvalidation([input('file:b', 'two'), input('file:a', 'one')])).toEqual({
			affectedArtifacts: [],
			changedKeys: ['file:a', 'file:b'],
			reusableArtifacts: []
		});
		expect(() =>
			empty.publish(
				request(
					'CLEAN',
					'a'.repeat(64),
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow(ContentAddressedStoreConflictError);

		const equivalence = new ContentAddressedFileStore(temporaryStoreRoot());
		equivalence.initialize();
		const first = equivalence.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'old')]
			)
		);
		expect(() =>
			equivalence.publish(
				request(
					'INCREMENTAL',
					first.generationId,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'different')],
					{ verifyCleanEquivalence: true }
				)
			)
		).toThrow(ContentAddressedStoreEquivalenceError);

		const reader = equivalence.openCurrentReadView();
		expect(reader).not.toBeNull();
		expect(() => reader!.readArtifact('missing')).toThrow(ContentAddressedStoreValidationError);
		reader!.close();
		const root = temporaryStoreRoot();
		const readerStore = new ContentAddressedFileStore(root);
		readerStore.initialize();
		readerStore.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		const removableReader = readerStore.openCurrentReadView()!;
		rmSync(join(root, 'readers', readdirSync(join(root, 'readers'))[0]!));
		removableReader.close();
		removableReader.close();
		expect(() => removableReader.readArtifact('artifact:a')).toThrow(
			ContentAddressedStoreConflictError
		);
		const replacedReader = readerStore.openCurrentReadView()!;
		const replacedPinPath = join(root, 'readers', readdirSync(join(root, 'readers'))[0]!);
		const replacedPin = readRecord(replacedPinPath);
		writeCanonical(replacedPinPath, { ...replacedPin, token: 'f'.repeat(32) });
		replacedReader.close();
		expect(existsSync(replacedPinPath)).toBe(true);

		const computeCases: readonly unknown[] = ['bad\ud800', '123456789', 42, new Uint8Array(9)];
		for (const value of computeCases) {
			const limited = new ContentAddressedFileStore(temporaryStoreRoot(), {
				maxArtifactBytes: 8
			});
			limited.initialize();
			expect(() =>
				limited.publish(
					request(
						'CLEAN',
						null,
						[input('file:a', 'one')],
						[output('artifact:a', ['file:a'], () => value as never)]
					)
				)
			).toThrow(ContentAddressedStoreValidationError);
		}
		const binaryRoot = temporaryStoreRoot();
		const binary = new ContentAddressedFileStore(binaryRoot);
		binary.initialize();
		binary.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => Uint8Array.of(1, 2, 3))]
			)
		);
		const binaryView = binary.openCurrentReadView()!;
		expect(binaryView.readArtifact('artifact:a')).toEqual(Uint8Array.of(1, 2, 3));
		binaryView.close();
		expect(() => binary.retain({ keepPublishedGenerations: 1, extra: true } as never)).toThrow(
			ContentAddressedStoreValidationError
		);

		const metadata = new ContentAddressedFileStore(temporaryStoreRoot(), {
			maxMetadataBytes: 128
		});
		metadata.initialize();
		expect(() =>
			metadata.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow(/generation manifest exceeds/u);
	});

	it('recovers or refuses every bounded store-format and layout shape', () => {
		const orphanRoot = temporaryStoreRoot();
		writeFileSync(join(orphanRoot, 'orphan'), 'state');
		expect(new ContentAddressedFileStore(orphanRoot).initialize()).toMatchObject({
			reason: 'MISSING_FORMAT_WITH_STATE',
			rebuildRequired: true
		});

		const corruptFormats: readonly string[] = ['', '{', '{} ', '1e400'];
		for (const contents of corruptFormats) {
			const root = temporaryStoreRoot();
			const store = new ContentAddressedFileStore(root);
			store.initialize();
			writeFileSync(join(root, 'format.json'), contents);
			expect(store.initialize()).toMatchObject({ reason: 'CORRUPT_FORMAT', rebuildRequired: true });
		}
		const wrongAlgorithmRoot = temporaryStoreRoot();
		const wrongAlgorithm = new ContentAddressedFileStore(wrongAlgorithmRoot);
		wrongAlgorithm.initialize();
		writeCanonical(join(wrongAlgorithmRoot, 'format.json'), {
			hashAlgorithm: 'MD5',
			schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.store
		});
		expect(wrongAlgorithm.initialize()).toMatchObject({
			reason: 'CORRUPT_FORMAT',
			rebuildRequired: true
		});

		const formatDirectoryRoot = temporaryStoreRoot();
		const formatDirectory = new ContentAddressedFileStore(formatDirectoryRoot);
		formatDirectory.initialize();
		rmSync(join(formatDirectoryRoot, 'format.json'));
		mkdirSync(join(formatDirectoryRoot, 'format.json'));
		expect(formatDirectory.initialize()).toMatchObject({
			reason: 'CORRUPT_FORMAT',
			rebuildRequired: true
		});

		const badLayoutRoot = temporaryStoreRoot();
		const badLayout = new ContentAddressedFileStore(badLayoutRoot);
		badLayout.initialize();
		rmSync(join(badLayoutRoot, 'artifacts'), { recursive: true });
		writeFileSync(join(badLayoutRoot, 'artifacts'), 'not-a-directory');
		expect(badLayout.initialize()).toMatchObject({
			reason: 'CORRUPT_LAYOUT',
			rebuildRequired: true
		});

		const unexpectedRoot = temporaryStoreRoot();
		const unexpected = new ContentAddressedFileStore(unexpectedRoot);
		unexpected.initialize();
		writeFileSync(join(unexpectedRoot, 'unexpected'), 'entry');
		expect(unexpected.initialize()).toMatchObject({
			reason: 'UNEXPECTED_ROOT_ENTRY',
			rebuildRequired: true
		});

		const abandonedRoot = temporaryStoreRoot();
		const abandoned = new ContentAddressedFileStore(abandonedRoot);
		abandoned.initialize();
		mkdirSync(join(abandonedRoot, 'staging', 'abandoned'));
		mkdirSync(join(abandonedRoot, 'trash', 'abandoned'));
		const abandonedCurrent = join(abandonedRoot, `.current-${'a'.repeat(32)}.tmp`);
		writeFileSync(abandonedCurrent, 'abandoned');
		abandoned.initialize();
		expect(readdirSync(join(abandonedRoot, 'staging'))).toEqual([]);
		expect(readdirSync(join(abandonedRoot, 'trash'))).toEqual([]);
		expect(existsSync(abandonedCurrent)).toBe(false);

		expect(() =>
			new ContentAddressedFileStore(temporaryStoreRoot(), { maxDirectoryEntries: 1 }).initialize()
		).toThrow(ContentAddressedStoreCorruptionError);

		const corruptPointerRoot = temporaryStoreRoot();
		const corruptPointer = new ContentAddressedFileStore(corruptPointerRoot);
		corruptPointer.initialize();
		corruptPointer.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		writeCanonical(join(corruptPointerRoot, 'current.json'), {
			...readRecord(join(corruptPointerRoot, 'current.json')),
			schema: 'unsupported'
		});
		expect(corruptPointer.initialize()).toMatchObject({
			reason: 'CORRUPT_CURRENT_GENERATION',
			rebuildRequired: true
		});

		const badDigestRoot = temporaryStoreRoot();
		const badDigest = new ContentAddressedFileStore(badDigestRoot);
		badDigest.initialize();
		badDigest.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		writeCanonical(join(badDigestRoot, 'current.json'), {
			...readRecord(join(badDigestRoot, 'current.json')),
			pointerSha256: '0'.repeat(64)
		});
		expect(badDigest.initialize()).toMatchObject({
			reason: 'CORRUPT_CURRENT_GENERATION',
			rebuildRequired: true
		});

		const wrongWitnessRoot = temporaryStoreRoot();
		const wrongWitness = new ContentAddressedFileStore(wrongWitnessRoot);
		wrongWitness.initialize();
		wrongWitness.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		const pointer = readRecord(join(wrongWitnessRoot, 'current.json'));
		writePointer(wrongWitnessRoot, pointer.generationId, '0'.repeat(64), 1);
		expect(wrongWitness.initialize()).toMatchObject({
			reason: 'CORRUPT_CURRENT_GENERATION',
			rebuildRequired: true
		});
	});

	it('recovers stale dead coordination records and fences live or replaced owners', () => {
		const clock = Date.now();
		const old = new Date(clock - 60_000);
		const staleOptions = {
			isProcessAlive: () => false,
			lockStaleAfterMs: 1,
			now: () => clock
		};
		const writerRecord = (token = 'a'.repeat(32)) => ({
			acquiredAtMs: clock - 60_000,
			pid: 12345,
			schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.writerLock,
			token
		});
		const acquisitionRecord = (token = 'b'.repeat(32), acquiredAtMs = clock - 60_000) => ({
			acquiredAtMs,
			pid: 12345,
			schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.lockAcquisition,
			token
		});

		const writerDirectoryRoot = temporaryStoreRoot();
		mkdirSync(join(writerDirectoryRoot, '.writer.lock'));
		expect(() => new ContentAddressedFileStore(writerDirectoryRoot).initialize()).toThrow(
			ContentAddressedStoreCorruptionError
		);

		const deadWriterRoot = temporaryStoreRoot();
		writeCanonical(join(deadWriterRoot, '.writer.lock'), writerRecord());
		utimesSync(join(deadWriterRoot, '.writer.lock'), old, old);
		expect(new ContentAddressedFileStore(deadWriterRoot, staleOptions).initialize()).toMatchObject({
			rebuildRequired: false
		});
		expect(existsSync(join(deadWriterRoot, '.writer.lock'))).toBe(false);

		const liveWriterRoot = temporaryStoreRoot();
		writeCanonical(join(liveWriterRoot, '.writer.lock'), writerRecord());
		utimesSync(join(liveWriterRoot, '.writer.lock'), old, old);
		expect(() =>
			new ContentAddressedFileStore(liveWriterRoot, {
				...staleOptions,
				isProcessAlive: () => true
			}).initialize()
		).toThrow(ContentAddressedStoreBusyError);

		const acquisitionDirectoryRoot = temporaryStoreRoot();
		mkdirSync(join(acquisitionDirectoryRoot, '.writer-acquisition.lock'));
		expect(() => new ContentAddressedFileStore(acquisitionDirectoryRoot).initialize()).toThrow(
			ContentAddressedStoreCorruptionError
		);

		const recentAcquisitionRoot = temporaryStoreRoot();
		writeCanonical(
			join(recentAcquisitionRoot, '.writer-acquisition.lock'),
			acquisitionRecord('b'.repeat(32), clock)
		);
		expect(() =>
			new ContentAddressedFileStore(recentAcquisitionRoot, staleOptions).initialize()
		).toThrow(ContentAddressedStoreBusyError);

		const invalidAcquisitionRoot = temporaryStoreRoot();
		writeFileSync(join(invalidAcquisitionRoot, '.writer-acquisition.lock'), 'invalid');
		utimesSync(join(invalidAcquisitionRoot, '.writer-acquisition.lock'), old, old);
		expect(
			new ContentAddressedFileStore(invalidAcquisitionRoot, staleOptions).initialize()
		).toMatchObject({ rebuildRequired: false });

		const deadAcquisitionRoot = temporaryStoreRoot();
		writeCanonical(join(deadAcquisitionRoot, '.writer-acquisition.lock'), acquisitionRecord());
		utimesSync(join(deadAcquisitionRoot, '.writer-acquisition.lock'), old, old);
		expect(
			new ContentAddressedFileStore(deadAcquisitionRoot, staleOptions).initialize()
		).toMatchObject({ rebuildRequired: false });

		const acquisitionFenceRoot = temporaryStoreRoot();
		let acquisitionClockCalls = 0;
		const acquisitionFence = new ContentAddressedFileStore(acquisitionFenceRoot, {
			now: () => {
				acquisitionClockCalls += 1;
				if (acquisitionClockCalls === 2)
					writeCanonical(join(acquisitionFenceRoot, '.writer-acquisition.lock'), {
						acquiredAtMs: clock,
						pid: process.pid,
						schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.lockAcquisition,
						token: 'f'.repeat(32)
					});
				return clock;
			}
		});
		expect(() => acquisitionFence.initialize()).toThrow(ContentAddressedStoreConflictError);

		const removedAcquisitionRoot = temporaryStoreRoot();
		let removalClockCalls = 0;
		const removedAcquisition = new ContentAddressedFileStore(removedAcquisitionRoot, {
			now: () => {
				removalClockCalls += 1;
				if (removalClockCalls === 2)
					rmSync(join(removedAcquisitionRoot, '.writer-acquisition.lock'), { force: true });
				return clock;
			}
		});
		expect(() => removedAcquisition.initialize()).toThrow();
		expect(existsSync(join(removedAcquisitionRoot, '.writer.lock'))).toBe(false);

		const writerFenceRoot = temporaryStoreRoot();
		const writerFence = new ContentAddressedFileStore(writerFenceRoot, {
			fault(point) {
				if (point !== 'BEFORE_POINTER_SWAP') return;
				writeCanonical(join(writerFenceRoot, '.writer.lock'), {
					acquiredAtMs: clock,
					pid: process.pid,
					schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.writerLock,
					token: 'e'.repeat(32)
				});
			}
		});
		writerFence.initialize();
		expect(() =>
			writerFence.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow(ContentAddressedStoreConflictError);

		const removedWriterRoot = temporaryStoreRoot();
		const removedWriter = new ContentAddressedFileStore(removedWriterRoot, {
			fault(point) {
				if (point === 'AFTER_STAGING_CREATED')
					rmSync(join(removedWriterRoot, '.writer.lock'), { force: true });
			}
		});
		removedWriter.initialize();
		expect(() =>
			removedWriter.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow();
		expect(existsSync(join(removedWriterRoot, '.writer.lock'))).toBe(false);
	});

	it('quarantines dangling publications and rejects corrupt retention directory entries', () => {
		const root = temporaryStoreRoot();
		const store = new ContentAddressedFileStore(root);
		store.initialize();
		const first = store.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		store.publish(
			request(
				'INCREMENTAL',
				first.generationId,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		writeCanonical(join(root, 'publications', publicationFileName(3)), {
			generationId: '0'.repeat(64),
			manifestSha256: '1'.repeat(64),
			publicationGeneration: 3,
			schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.publication
		});
		store.retain({ keepPublishedGenerations: 2 });
		expect(existsSync(join(root, 'publications', publicationFileName(3)))).toBe(false);
		expect(existsSync(join(root, 'publications', publicationFileName(1)))).toBe(false);
		expect(existsSync(join(root, 'publications', publicationFileName(2)))).toBe(true);
		expect(currentText(store)).toBe('value');
		expect(readdirSync(join(root, 'quarantine')).length).toBeGreaterThan(0);

		const corruptions: readonly ((rootValue: string) => void)[] = [
			(rootValue) => mkdirSync(join(rootValue, 'generations', 'bad')),
			(rootValue) => mkdirSync(join(rootValue, 'artifacts', 'zz')),
			(rootValue) => {
				mkdirSync(join(rootValue, 'artifacts', 'aa'));
				writeFileSync(join(rootValue, 'artifacts', 'aa', 'bad.blob'), 'bad');
			}
		];
		for (const corrupt of corruptions) {
			const corruptRoot = temporaryStoreRoot();
			const corruptStore = new ContentAddressedFileStore(corruptRoot);
			corruptStore.initialize();
			corrupt(corruptRoot);
			expect(() => corruptStore.retain({ keepPublishedGenerations: 0 })).toThrow(
				ContentAddressedStoreCorruptionError
			);
		}
	});

	it('recovers publication logs and rejects collisions, malformed generations, and exhaustion', () => {
		const root = temporaryStoreRoot();
		let contradictPublication = false;
		const store = new ContentAddressedFileStore(root, {
			fault(point) {
				if (point !== 'AFTER_POINTER_SWAP') return;
				const pointer = readRecord(join(root, 'current.json'));
				const publication = publicationFromPointer(pointer);
				writeCanonical(
					join(root, 'publications', publicationFileName(pointer.publicationGeneration as number)),
					contradictPublication ? { ...publication, generationId: '0'.repeat(64) } : publication
				);
			}
		});
		store.initialize();
		const first = store.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'first')]
			)
		);
		expect(first.publicationGeneration).toBe(1);

		contradictPublication = true;
		expect(() =>
			store.publish(
				request(
					'INCREMENTAL',
					first.generationId,
					[input('file:a', 'two')],
					[output('artifact:a', ['file:a'], () => 'second')]
				)
			)
		).toThrow(ContentAddressedStoreCorruptionError);
		const current = readRecord(join(root, 'current.json'));
		const currentPublicationPath = join(
			root,
			'publications',
			publicationFileName(current.publicationGeneration as number)
		);
		const recovered = new ContentAddressedFileStore(root);
		expect(recovered.initialize()).toMatchObject({
			currentGenerationId: current.generationId,
			rebuildRequired: false
		});
		expect(currentText(recovered)).toBe('second');
		expect(readRecord(currentPublicationPath)).toEqual(publicationFromPointer(current));

		const malformedRoot = temporaryStoreRoot();
		const malformed = new ContentAddressedFileStore(malformedRoot, {
			fault(point) {
				if (point === 'AFTER_GENERATION_PUBLISHED')
					writeFileSync(join(malformedRoot, 'publications', 'bad.json'), 'bad');
			}
		});
		malformed.initialize();
		expect(() =>
			malformed.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow(ContentAddressedStoreCorruptionError);
		expect(new ContentAddressedFileStore(malformedRoot).initialize()).toMatchObject({
			rebuildRequired: false
		});

		const mismatchRoot = temporaryStoreRoot();
		const mismatch = new ContentAddressedFileStore(mismatchRoot, {
			fault(point) {
				if (point === 'AFTER_GENERATION_PUBLISHED')
					writeCanonical(join(mismatchRoot, 'publications', publicationFileName(1)), {
						generationId: '0'.repeat(64),
						manifestSha256: '1'.repeat(64),
						publicationGeneration: 2,
						schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.publication
					});
			}
		});
		mismatch.initialize();
		expect(() =>
			mismatch.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow(ContentAddressedStoreCorruptionError);
		expect(new ContentAddressedFileStore(mismatchRoot).initialize()).toMatchObject({
			rebuildRequired: false
		});
		expect(existsSync(join(mismatchRoot, 'publications', publicationFileName(1)))).toBe(false);

		const exhaustedRoot = temporaryStoreRoot();
		const exhausted = new ContentAddressedFileStore(exhaustedRoot);
		exhausted.initialize();
		writeCanonical(
			join(exhaustedRoot, 'publications', publicationFileName(Number.MAX_SAFE_INTEGER)),
			{
				generationId: '0'.repeat(64),
				manifestSha256: '1'.repeat(64),
				publicationGeneration: Number.MAX_SAFE_INTEGER,
				schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.publication
			}
		);
		expect(() =>
			exhausted.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			)
		).toThrow(ContentAddressedStoreCorruptionError);
	});

	it('quarantines stale reader pins and rejects contradictory reader witnesses', () => {
		const clock = Date.now();
		const createPublishedStore = (root: string) => {
			const store = new ContentAddressedFileStore(root, {
				isProcessAlive: () => false,
				now: () => clock,
				readerStaleAfterMs: 1
			});
			store.initialize();
			store.publish(
				request(
					'CLEAN',
					null,
					[input('file:a', 'one')],
					[output('artifact:a', ['file:a'], () => 'value')]
				)
			);
			return { pointer: readRecord(join(root, 'current.json')), store };
		};
		const pin = (
			pointer: Record<string, unknown>,
			token: string,
			overrides: Readonly<Record<string, unknown>> = {}
		) => ({
			createdAtMs: clock - 60_000,
			generationId: pointer.generationId,
			manifestSha256: pointer.manifestSha256,
			pid: 12345,
			schema: CONTENT_ADDRESSED_FILE_STORE_SCHEMAS.readerPin,
			token,
			...overrides
		});

		const invalidEntryRoot = temporaryStoreRoot();
		const invalidEntry = createPublishedStore(invalidEntryRoot);
		mkdirSync(join(invalidEntryRoot, 'readers', 'bad'));
		expect(() => invalidEntry.store.retain({ keepPublishedGenerations: 1 })).toThrow(
			ContentAddressedStoreCorruptionError
		);

		const staleRoot = temporaryStoreRoot();
		const stale = createPublishedStore(staleRoot);
		const invalidToken = 'a'.repeat(32);
		const deadToken = 'b'.repeat(32);
		const invalidPath = join(staleRoot, 'readers', `${invalidToken}.json`);
		const deadPath = join(staleRoot, 'readers', `${deadToken}.json`);
		writeFileSync(invalidPath, 'invalid');
		writeCanonical(deadPath, pin(stale.pointer, deadToken));
		const old = new Date(clock - 60_000);
		utimesSync(invalidPath, old, old);
		utimesSync(deadPath, old, old);
		stale.store.retain({ keepPublishedGenerations: 1 });
		expect(readdirSync(join(staleRoot, 'readers'))).toEqual([]);

		const recentInvalidRoot = temporaryStoreRoot();
		const recentInvalid = createPublishedStore(recentInvalidRoot);
		writeFileSync(join(recentInvalidRoot, 'readers', `${'9'.repeat(32)}.json`), 'invalid');
		expect(() => recentInvalid.store.retain({ keepPublishedGenerations: 1 })).toThrow(
			ContentAddressedStoreCorruptionError
		);

		const tokenMismatchRoot = temporaryStoreRoot();
		const tokenMismatch = createPublishedStore(tokenMismatchRoot);
		writeCanonical(
			join(tokenMismatchRoot, 'readers', `${'c'.repeat(32)}.json`),
			pin(tokenMismatch.pointer, 'd'.repeat(32), { createdAtMs: clock })
		);
		expect(() => tokenMismatch.store.retain({ keepPublishedGenerations: 1 })).toThrow(
			ContentAddressedStoreCorruptionError
		);

		const witnessMismatchRoot = temporaryStoreRoot();
		const witnessMismatch = createPublishedStore(witnessMismatchRoot);
		const witnessToken = 'e'.repeat(32);
		writeCanonical(
			join(witnessMismatchRoot, 'readers', `${witnessToken}.json`),
			pin(witnessMismatch.pointer, witnessToken, {
				createdAtMs: clock,
				manifestSha256: 'f'.repeat(64)
			})
		);
		expect(() => witnessMismatch.store.retain({ keepPublishedGenerations: 1 })).toThrow(
			ContentAddressedStoreCorruptionError
		);

		const liveRoot = temporaryStoreRoot();
		const liveStore = new ContentAddressedFileStore(liveRoot);
		liveStore.initialize();
		liveStore.publish(
			request(
				'CLEAN',
				null,
				[input('file:a', 'one')],
				[output('artifact:a', ['file:a'], () => 'value')]
			)
		);
		const livePointer = readRecord(join(liveRoot, 'current.json'));
		const liveToken = '8'.repeat(32);
		writeCanonical(
			join(liveRoot, 'readers', `${liveToken}.json`),
			pin(livePointer, liveToken, { createdAtMs: 0, pid: process.pid })
		);
		liveStore.retain({ keepPublishedGenerations: 1 });
		expect(existsSync(join(liveRoot, 'readers', `${liveToken}.json`))).toBe(true);
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
