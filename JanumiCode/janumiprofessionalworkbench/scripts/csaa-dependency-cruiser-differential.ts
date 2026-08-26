import {
	closeSync,
	fsyncSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
	CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_SCHEMA_VERSION,
	CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
	CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_SCHEMA_VERSION,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REVIEWED_DIGEST,
	CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST,
	currentDependencyCruiserEvidenceDigestsAreValid,
	defaultCurrentDependencyCruiserG4ClosureRequest,
	defaultCurrentDependencyCruiserDifferentialRequest,
	runCurrentDependencyCruiserG4Closure,
	runCurrentDependencyCruiserDifferential,
	type CurrentDependencyCruiserDifferentialEvidence,
	type CurrentDependencyCruiserG4ClosureEvidence
} from '../packages/csaa/src/graph/run-current-dependency-cruiser-differential.js';
import { canonicalJson } from '../packages/csaa/src/inventory/canonical.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
type Mode = '--check' | '--g4-check' | '--g4-json' | '--g4-write' | '--json' | '--write';
type Evidence =
	CurrentDependencyCruiserDifferentialEvidence | CurrentDependencyCruiserG4ClosureEvidence;

function mode(argv: readonly string[]): Mode {
	if (
		argv.length !== 1 ||
		!['--check', '--g4-check', '--g4-json', '--g4-write', '--json', '--write'].includes(argv[0]!)
	)
		throw new Error(
			'Usage: bun scripts/csaa-dependency-cruiser-differential.ts --write|--check|--json|--g4-write|--g4-check|--g4-json'
		);
	return argv[0] as Mode;
}

function evidenceText(evidence: Evidence): string {
	return canonicalJson(evidence);
}

function atomicWrite(path: string, text: string): void {
	const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
	let descriptor: number | null = null;
	try {
		descriptor = openSync(temporary, 'wx', 0o600);
		writeFileSync(descriptor, text, 'utf8');
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = null;
		renameSync(temporary, path);
	} finally {
		if (descriptor !== null) closeSync(descriptor);
		rmSync(temporary, { force: true });
	}
}

function parseEvidence(text: string, g4: boolean): Evidence {
	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch {
		throw new Error('The checked-in dependency-cruiser differential evidence is not JSON.');
	}
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error('The checked-in dependency-cruiser differential evidence is not an object.');
	const evidence = value as Evidence;
	const expectedSchema = g4
		? CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_SCHEMA_VERSION
		: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_EVIDENCE_SCHEMA_VERSION;
	const expectedOperation = g4
		? CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_OPERATION_VERSION
		: CURRENT_DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION;
	if (
		evidence.schemaVersion !== expectedSchema ||
		evidence.operationVersion !== expectedOperation ||
		evidence.analysisAuthority !== 'NONE' ||
		evidence.gateEffect !== 'NONE' ||
		g4 !== 'g4Closure' in evidence
	)
		throw new Error('The checked-in dependency-cruiser differential evidence identity is invalid.');
	if (evidenceText(evidence) !== text)
		throw new Error('The checked-in dependency-cruiser differential evidence is not canonical.');
	if (!currentDependencyCruiserEvidenceDigestsAreValid(evidence))
		throw new Error('The checked-in dependency-cruiser differential evidence digest is invalid.');
	return evidence;
}

function stableProjection(evidence: Evidence): unknown {
	const common = {
		analysisAuthority: evidence.analysisAuthority,
		capabilityStatus: evidence.capabilityStatus,
		currentness: evidence.currentness,
		differentialDigest: evidence.differential.differentialDigest,
		gateEffect: evidence.gateEffect,
		graph: evidence.graph,
		nonclaims: evidence.nonclaims,
		operationVersion: evidence.operationVersion,
		provider: evidence.provider,
		resourceGuard: evidence.resourceGuard,
		reviewedBaseline: evidence.reviewedBaseline,
		schemaVersion: evidence.schemaVersion,
		semanticSnapshot: evidence.semanticSnapshot,
		subject: evidence.subject,
		wireShape: evidence.wireShape
	};
	return 'g4Closure' in evidence
		? {
				...common,
				discoveryClosureDigest: evidence.discovery.closureDigest,
				g4Closure: evidence.g4Closure
			}
		: common;
}

function run(g4: boolean) {
	return g4
		? runCurrentDependencyCruiserG4Closure(
				defaultCurrentDependencyCruiserG4ClosureRequest(
					ROOT,
					CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REVIEWED_DIGEST
				)
			)
		: runCurrentDependencyCruiserDifferential(
				defaultCurrentDependencyCruiserDifferentialRequest(
					ROOT,
					CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST
				)
			);
}

function main(): void {
	const selectedMode = mode(process.argv.slice(2));
	const g4 = selectedMode.startsWith('--g4-');
	const action = selectedMode.replace('--g4-', '--') as '--check' | '--json' | '--write';
	const evidenceLogicalPath = g4
		? CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_EVIDENCE_PATH
		: CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH;
	const evidencePath = resolve(ROOT, evidenceLogicalPath);
	const outcome = run(g4);
	if (action === '--json') {
		process.stdout.write(`${canonicalJson(outcome)}\n`);
		if (outcome.outcome !== 'accepted') process.exitCode = 1;
		return;
	}
	if (outcome.outcome !== 'accepted')
		throw new Error(`${outcome.diagnostics[0].code}: ${outcome.diagnostics[0].message}`);
	if (action === '--write') {
		atomicWrite(evidencePath, evidenceText(outcome.evidence));
		process.stdout.write(
			`${canonicalJson({ contentDigest: outcome.evidence.contentDigest, evidencePath: evidenceLogicalPath, state: 'WRITTEN' })}\n`
		);
		return;
	}
	const persisted = parseEvidence(readFileSync(evidencePath, 'utf8'), g4);
	if (
		canonicalJson(stableProjection(persisted)) !== canonicalJson(stableProjection(outcome.evidence))
	)
		throw new Error(
			'The checked-in dependency-cruiser differential evidence does not match the current stable evidence projection.'
		);
	process.stdout.write(
		`${canonicalJson({ contentDigest: persisted.contentDigest, evidencePath: evidenceLogicalPath, state: 'CURRENT' })}\n`
	);
}

try {
	main();
} catch (cause) {
	const message = cause instanceof Error ? cause.message : String(cause);
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
}
