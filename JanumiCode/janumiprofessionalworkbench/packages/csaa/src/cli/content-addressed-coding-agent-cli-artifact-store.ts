import { createHash } from 'node:crypto';

import {
	CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS,
	ContentAddressedFileStore,
	ContentAddressedStoreConflictError,
	type ContentAddressedArtifactDefinition,
	type ContentAddressedArtifactReference,
	type ContentAddressedFileStoreOptions
} from '../persistence/content-addressed-file-store.js';
import {
	CodingAgentCliArtifactError,
	codingAgentCliArtifactDigest,
	type CodingAgentCliArtifactStore,
	type CodingAgentCliArtifactTransaction
} from './coding-agent-cli-artifact-store.js';

export const CODING_AGENT_CLI_PERSISTENT_ARTIFACT_KIND =
	'JAN_CSAA_CODING_AGENT_CANONICAL_JSON' as const;
export const CODING_AGENT_CLI_PERSISTENT_ARTIFACT_TRANSFORM_VERSION =
	'jan-csaa-coding-agent-canonical-json-artifact/0.1.0' as const;
export const CODING_AGENT_CLI_PERSISTENT_SESSION_SUBJECT =
	'jan-csaa-coding-agent-workflow-session/0.1.0' as const;
export const CODING_AGENT_CLI_PERSISTENT_COMMIT_RETRIES = 8;

interface ActiveTransaction {
	readonly signal: AbortSignal | undefined;
	readonly staged: Map<string, Uint8Array>;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function materializeWrite(reference: string, bytes: Uint8Array): Uint8Array {
	const expected = codingAgentCliArtifactDigest(reference);
	if (
		!(bytes instanceof Uint8Array) ||
		bytes.byteLength > CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxArtifactBytes
	)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_BUDGET_EXCEEDED',
			'The persistent coding-agent artifact exceeds its byte ceiling.'
		);
	const copy = Uint8Array.from(bytes);
	if (sha256(copy) !== expected)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_DIGEST_MISMATCH',
			'The persistent artifact bytes do not match their content address.'
		);
	return copy;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
	);
}

function assertOwnedReference(reference: ContentAddressedArtifactReference): void {
	if (
		reference.artifactKind !== CODING_AGENT_CLI_PERSISTENT_ARTIFACT_KIND ||
		reference.transformVersion !== CODING_AGENT_CLI_PERSISTENT_ARTIFACT_TRANSFORM_VERSION ||
		reference.dependencyKeys.length !== 0 ||
		reference.logicalKey !== `artifact:sha256:${reference.sha256}`
	)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_STORE_FAILED',
			'The persistent coding-agent store contains an incompatible artifact generation.'
		);
}

function reusableDefinition(
	reference: ContentAddressedArtifactReference
): ContentAddressedArtifactDefinition {
	assertOwnedReference(reference);
	return {
		artifactKind: CODING_AGENT_CLI_PERSISTENT_ARTIFACT_KIND,
		compute: () => {
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'A previously published immutable artifact was unexpectedly selected for recomputation.'
			);
		},
		dependencyKeys: [],
		logicalKey: reference.logicalKey,
		transformVersion: CODING_AGENT_CLI_PERSISTENT_ARTIFACT_TRANSFORM_VERSION
	};
}

function stagedDefinition(
	reference: string,
	bytes: Uint8Array
): ContentAddressedArtifactDefinition {
	return {
		artifactKind: CODING_AGENT_CLI_PERSISTENT_ARTIFACT_KIND,
		compute: () => Uint8Array.from(bytes),
		dependencyKeys: [],
		logicalKey: reference,
		transformVersion: CODING_AGENT_CLI_PERSISTENT_ARTIFACT_TRANSFORM_VERSION
	};
}

/**
 * A transaction-aware adapter over the generation store. Handler writes remain staged until the
 * CLI has validated one terminal response, so cancellation or internal failure can roll back all
 * artifacts from that invocation. Rollback permanently revokes publication through this adapter,
 * so a handler that ignores cancellation cannot auto-open a later transaction and publish after
 * the CLI has returned. A subsequent invocation must use a fresh adapter over the same store root.
 * The store root is supplied only by the trusted host process.
 */
export class ContentAddressedCodingAgentCliArtifactStore
	implements CodingAgentCliArtifactStore, CodingAgentCliArtifactTransaction
{
	readonly #store: ContentAddressedFileStore;
	#active: ActiveTransaction | null = null;
	#initialized = false;
	#publicationRevoked = false;

	public constructor(root: string, options?: ContentAddressedFileStoreOptions) {
		this.#store = new ContentAddressedFileStore(root, options);
	}

	#initialize(): void {
		if (this.#initialized) return;
		this.#store.initialize();
		this.#initialized = true;
	}

	public begin(signal?: AbortSignal): void {
		if (this.#publicationRevoked)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'The persistent coding-agent adapter was terminally revoked by rollback.'
			);
		if (this.#active !== null)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'The persistent coding-agent store already has an active transaction.'
			);
		if (signal?.aborted === true)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'The persistent coding-agent transaction was cancelled before it began.'
			);
		this.#initialize();
		this.#active = { signal, staged: new Map() };
	}

	public read(reference: string): Uint8Array | null {
		codingAgentCliArtifactDigest(reference);
		const staged = this.#active?.staged.get(reference);
		if (staged !== undefined) return Uint8Array.from(staged);
		this.#initialize();
		const view = this.#store.openCurrentReadView();
		if (view === null) return null;
		try {
			if (view.subjectId !== CODING_AGENT_CLI_PERSISTENT_SESSION_SUBJECT)
				throw new CodingAgentCliArtifactError(
					'ARTIFACT_STORE_FAILED',
					'The persistent coding-agent store belongs to an incompatible workflow namespace.'
				);
			const entry = view.artifacts.find((candidate) => candidate.logicalKey === reference);
			if (entry === undefined) return null;
			assertOwnedReference(entry);
			return view.readArtifact(reference);
		} finally {
			view.close();
		}
	}

	public write(reference: string, bytes: Uint8Array): void {
		if (this.#publicationRevoked)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'The persistent coding-agent adapter refuses publication after rollback.'
			);
		const materialized = materializeWrite(reference, bytes);
		if (this.#active === null) {
			this.begin();
			try {
				this.#stage(reference, materialized);
				this.commit();
			} catch (error) {
				this.rollback();
				throw error;
			}
			return;
		}
		this.#stage(reference, materialized);
	}

	#stage(reference: string, bytes: Uint8Array): void {
		const active = this.#active!;
		if (active.signal?.aborted === true)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'The persistent coding-agent transaction was cancelled.'
			);
		const existing = active.staged.get(reference) ?? this.read(reference);
		if (existing !== null) {
			if (!equalBytes(existing, bytes))
				throw new CodingAgentCliArtifactError(
					'ARTIFACT_DIGEST_MISMATCH',
					'The persistent content address already names different bytes.'
				);
			return;
		}
		active.staged.set(reference, Uint8Array.from(bytes));
	}

	#stagedWritesAreDurablyCurrent(staged: ReadonlyMap<string, Uint8Array>): boolean {
		let view: ReturnType<ContentAddressedFileStore['openCurrentReadView']> = null;
		let verified = false;
		try {
			view = this.#store.openCurrentReadView();
			if (view === null || view.subjectId !== CODING_AGENT_CLI_PERSISTENT_SESSION_SUBJECT)
				return false;
			const currentByKey = new Map(
				view.artifacts.map((reference) => {
					assertOwnedReference(reference);
					return [reference.logicalKey, reference] as const;
				})
			);
			verified = [...staged].every(([reference, bytes]) => {
				const current = currentByKey.get(reference);
				return current !== undefined && equalBytes(view!.readArtifact(reference), bytes);
			});
		} catch {
			verified = false;
		} finally {
			try {
				view?.close();
			} catch {
				// Reader-pin cleanup does not change which generation is durably current.
			}
		}
		return verified;
	}

	public commit(): void {
		const active = this.#active;
		if (active === null)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_STORE_FAILED',
				'The persistent coding-agent store has no active transaction to commit.'
			);
		if (active.staged.size === 0) {
			this.#active = null;
			return;
		}
		for (let attempt = 0; attempt < CODING_AGENT_CLI_PERSISTENT_COMMIT_RETRIES; attempt += 1) {
			if (active.signal?.aborted === true)
				throw new CodingAgentCliArtifactError(
					'ARTIFACT_STORE_FAILED',
					'The persistent coding-agent transaction was cancelled before publication.'
				);
			const view = this.#store.openCurrentReadView();
			let expectedCurrentGenerationId: string | null = null;
			let prior: readonly ContentAddressedArtifactReference[] = [];
			try {
				if (view !== null) {
					if (view.subjectId !== CODING_AGENT_CLI_PERSISTENT_SESSION_SUBJECT)
						throw new CodingAgentCliArtifactError(
							'ARTIFACT_STORE_FAILED',
							'The persistent coding-agent store belongs to an incompatible workflow namespace.'
						);
					expectedCurrentGenerationId = view.generationId;
					prior = [...view.artifacts];
					for (const reference of prior) assertOwnedReference(reference);
					for (const [reference, bytes] of active.staged) {
						const existing = prior.find((candidate) => candidate.logicalKey === reference);
						if (existing !== undefined && !equalBytes(view.readArtifact(reference), bytes))
							throw new CodingAgentCliArtifactError(
								'ARTIFACT_DIGEST_MISMATCH',
								'The persistent content address already names different bytes.'
							);
					}
				}
			} finally {
				view?.close();
			}
			const priorByKey = new Map(prior.map((reference) => [reference.logicalKey, reference]));
			const outputs: ContentAddressedArtifactDefinition[] = prior.map(reusableDefinition);
			for (const [reference, bytes] of active.staged)
				if (!priorByKey.has(reference)) outputs.push(stagedDefinition(reference, bytes));
			try {
				this.#store.publish({
					expectedCurrentGenerationId,
					invalidationInputs: [],
					mode: expectedCurrentGenerationId === null ? 'CLEAN' : 'INCREMENTAL',
					outputs,
					signal: active.signal,
					subjectId: CODING_AGENT_CLI_PERSISTENT_SESSION_SUBJECT,
					verifyCleanEquivalence: false
				});
				this.#active = null;
				return;
			} catch (error) {
				if (error instanceof ContentAddressedStoreConflictError) continue;
				// The durable store can report an injected or operating-system exception after its
				// current-pointer linearization point. A response may report success only when a fresh
				// read proves the exact workflow namespace and every staged content witness are current.
				if (this.#stagedWritesAreDurablyCurrent(active.staged)) {
					this.#active = null;
					return;
				}
				throw error;
			}
		}
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_STORE_FAILED',
			'The persistent coding-agent artifact commit exhausted its bounded conflict retries.'
		);
	}

	public rollback(): void {
		this.#active = null;
		this.#publicationRevoked = true;
	}
}
