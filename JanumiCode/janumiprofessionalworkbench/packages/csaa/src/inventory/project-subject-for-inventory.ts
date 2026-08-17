import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	type FrozenSubject
} from '../contracts/subject.js';
import { resolveSubject } from '../subject/resolve-subject.js';

export const INVENTORY_SUBJECT_OUTPUTS = [
	'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md',
	'verif/csaa/jan-csaa-005.inventory.baseline.json'
] as const;

export function projectSubjectForInventory(repositoryRoot: string): FrozenSubject {
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
		operationVersion: 'jan-csaa-inventory/0.2.0',
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
	return outcome.subject;
}
