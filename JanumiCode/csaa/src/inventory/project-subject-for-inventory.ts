import { closeSync, existsSync, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject,
	type GeneratedContextEvidenceRecord
} from '../contracts/subject.js';
import { parseGeneratedContextEvidenceRecord } from '../subject/generated-context.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import {
	RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH,
	RPH_DEMO_GENERATED_CONTEXT_PATH,
	SVELTE_KIT_SYNC_GENERATOR_ID
} from '../subject/svelte-kit-generator.js';

export const INVENTORY_SUBJECT_OUTPUTS = [
	'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md',
	'verif/csaa/jan-csaa-005.inventory.baseline.json'
] as const;

const MAX_GENERATED_CONTEXT_EVIDENCE_BYTES = 16 * 1024 * 1024;

function readGeneratedContextEvidence(repositoryRoot: string): {
	readonly bytes: Buffer;
	readonly record: GeneratedContextEvidenceRecord;
} {
	const path = resolve(repositoryRoot, RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH);
	if (!existsSync(path)) throw new Error('Required JPWB generated-context evidence is absent.');
	const pathBefore = lstatSync(path, { bigint: true });
	if (
		!pathBefore.isFile() ||
		pathBefore.isSymbolicLink() ||
		pathBefore.size > BigInt(MAX_GENERATED_CONTEXT_EVIDENCE_BYTES)
	)
		throw new Error('JPWB generated-context evidence is not a bounded regular file.');
	const descriptor = openSync(path, 'r');
	try {
		const before = fstatSync(descriptor, { bigint: true });
		const bytes = readFileSync(descriptor);
		const after = fstatSync(descriptor, { bigint: true });
		const pathAfter = lstatSync(path, { bigint: true });
		if (
			bytes.byteLength > MAX_GENERATED_CONTEXT_EVIDENCE_BYTES ||
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.mtimeNs !== after.mtimeNs ||
			pathBefore.dev !== pathAfter.dev ||
			pathBefore.ino !== pathAfter.ino ||
			pathBefore.size !== pathAfter.size ||
			pathBefore.mtimeNs !== pathAfter.mtimeNs ||
			pathAfter.dev !== after.dev ||
			pathAfter.ino !== after.ino
		)
			throw new Error('JPWB generated-context evidence changed during its bounded read.');
		const record = parseGeneratedContextEvidenceRecord(bytes);
		if (record.generator.id !== SVELTE_KIT_SYNC_GENERATOR_ID)
			throw new Error('JPWB generated-context evidence names an unsupported generator.');
		return { bytes, record };
	} finally {
		closeSync(descriptor);
	}
}

export function projectSubjectForInventory(repositoryRoot: string): FrozenSubject {
	const hasRphDemoGeneratedContext = existsSync(
		resolve(repositoryRoot, RPH_DEMO_GENERATED_CONTEXT_PATH)
	);
	const initialEvidence = hasRphDemoGeneratedContext
		? readGeneratedContextEvidence(repositoryRoot)
		: null;
	const outcome = resolveSubject({
		budgets: {
			maxBytes: 256 * 1024 * 1024,
			maxConfigDepth: 64,
			maxDiagnostics: 10_000,
			maxDurationMs: 120_000,
			maxFiles: 100_000,
			maxProjects: 1_000
		},
		filters: { exclude: [], include: [] },
		generatedContextEvidence:
			initialEvidence === null
				? undefined
				: [
						{
							generator: initialEvidence.record.generator,
							path: RPH_DEMO_GENERATED_CONTEXT_PATH,
							source: RPH_DEMO_GENERATED_CONTEXT_EVIDENCE_PATH
						}
					],
		operationVersion: 'jan-csaa-inventory/0.3.0',
		outputs: INVENTORY_SUBJECT_OUTPUTS,
		policyVersion: SUBJECT_POLICY_VERSION,
		rootLocator: repositoryRoot,
		schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
		scope: { kind: 'REPOSITORY' },
		subjectKind: 'WORKTREE'
	});
	if (outcome.outcome !== 'resolved') {
		const diagnosticSummary = outcome.diagnostics
			.map((item) => `${item.code}: ${item.message}`)
			.join('; ');
		throw new Error(`CSAA subject resolution ${outcome.outcome}: ${diagnosticSummary}`);
	}
	if (initialEvidence !== null) {
		const finalEvidence = readGeneratedContextEvidence(repositoryRoot);
		if (!initialEvidence.bytes.equals(finalEvidence.bytes))
			throw new Error('Generated-context evidence changed during inventory subject resolution.');
	}
	return outcome.subject;
}
