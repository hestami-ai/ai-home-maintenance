import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { InventoryDocument } from '../contracts/inventory.js';
import { canonicalJson, sha256 } from './canonical.js';
import { collectInventory } from './collect-inventory.js';
import { renderInventoryMarkdown } from './render-inventory.js';

export const GENERATED_REGION_BEGIN = '<!-- JAN-CSAA-005:GENERATED-INVENTORY:BEGIN -->';
export const GENERATED_REGION_END = '<!-- JAN-CSAA-005:GENERATED-INVENTORY:END -->';
export const DEFAULT_DOCUMENT_PATH =
	'docs/ASTs and Code Analysis/JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md';
export const DEFAULT_BASELINE_PATH = 'verif/csaa/jan-csaa-005.inventory.baseline.json';

export type InventoryMode = 'write' | 'check' | 'json';

export interface RunInventoryOptions {
	readonly mode: InventoryMode;
	readonly repositoryRoot: string;
	readonly requireJpwbPopulations?: boolean;
	/** Test-only synchronous failure injection used to prove first-commit rollback. */
	readonly afterFirstCommit?: () => void;
}

export interface InventoryDifference {
	readonly actualBytes: number | null;
	readonly actualSha256: string | null;
	readonly expectedBytes: number;
	readonly expectedSha256: string;
	readonly path: string;
}

export interface RunInventoryResult {
	readonly differences: readonly InventoryDifference[];
	readonly inventory: InventoryDocument;
	readonly json: string;
	readonly mode: InventoryMode;
	readonly ok: boolean;
	readonly subjectId: string;
}

function occurrences(haystack: string, needle: string): number {
	let count = 0;
	let offset = 0;
	while (true) {
		const found = haystack.indexOf(needle, offset);
		if (found < 0) return count;
		count += 1;
		offset = found + needle.length;
	}
}

function assertStandaloneMarker(content: string, marker: string, offset: number): void {
	const before = offset === 0 ? '' : content[offset - 1];
	const after = content[offset + marker.length] ?? '';
	if ((before !== '' && before !== '\n') || (after !== '' && after !== '\r' && after !== '\n')) {
		throw new Error(`Generated-region marker is not on its own line: ${marker}`);
	}
}

export function replaceGeneratedRegion(document: string, markdown: string): string {
	if (
		occurrences(document, GENERATED_REGION_BEGIN) !== 1 ||
		occurrences(document, GENERATED_REGION_END) !== 1
	) {
		throw new Error(
			'JAN-CSAA-005 must contain exactly one begin marker and exactly one end marker'
		);
	}
	const begin = document.indexOf(GENERATED_REGION_BEGIN);
	const end = document.indexOf(GENERATED_REGION_END);
	if (begin >= end) throw new Error('JAN-CSAA-005 generated-region markers are reversed');
	assertStandaloneMarker(document, GENERATED_REGION_BEGIN, begin);
	assertStandaloneMarker(document, GENERATED_REGION_END, end);
	const eol = document.includes('\r\n') ? '\r\n' : '\n';
	const normalized = markdown
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.trimEnd()
		.replaceAll('\n', eol);
	return `${document.slice(0, begin + GENERATED_REGION_BEGIN.length)}${eol}${normalized}${eol}${document.slice(end)}`;
}

function difference(path: string, expected: string, actual: string | null): InventoryDifference {
	return {
		actualBytes: actual === null ? null : Buffer.byteLength(actual),
		actualSha256: actual === null ? null : sha256(actual),
		expectedBytes: Buffer.byteLength(expected),
		expectedSha256: sha256(expected),
		path
	};
}

let temporarySequence = 0;

function stageAtomic(path: string, content: string): string {
	mkdirSync(dirname(path), { recursive: true });
	temporarySequence += 1;
	const temporary = `${path}.csaa-${process.pid}-${temporarySequence}.tmp`;
	try {
		writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
		if (readFileSync(temporary, 'utf8') !== content) {
			throw new Error(`Staged output failed exact-byte validation: ${temporary}`);
		}
		return temporary;
	} catch (error) {
		if (existsSync(temporary)) unlinkSync(temporary);
		throw error;
	}
}

function validateProducts(inventory: InventoryDocument, json: string, document: string): void {
	const parsed = JSON.parse(json) as unknown;
	if (canonicalJson(parsed) !== json) throw new Error('Rendered inventory JSON is not canonical');
	if (!document.includes(inventory.subject.subjectId)) {
		throw new Error('Rendered JAN-CSAA-005 region does not carry the subject ID');
	}
	if (
		occurrences(document, GENERATED_REGION_BEGIN) !== 1 ||
		occurrences(document, GENERATED_REGION_END) !== 1
	) {
		throw new Error('Rendered JAN-CSAA-005 marker cardinality is invalid');
	}
}

function readBaselineIfPresent(absoluteBaseline: string): string | null {
	return existsSync(absoluteBaseline) ? readFileSync(absoluteBaseline, 'utf8') : null;
}

interface CheckModeInputs {
	readonly absoluteBaseline: string;
	readonly baselinePath: string;
	readonly currentDocument: string;
	readonly documentPath: string;
	readonly expectedDocument: string;
	readonly json: string;
}

function collectCheckDifferences(inputs: CheckModeInputs): InventoryDifference[] {
	const currentJson = readBaselineIfPresent(inputs.absoluteBaseline);
	const differences: InventoryDifference[] = [];
	if (currentJson !== inputs.json) {
		differences.push(difference(inputs.baselinePath, inputs.json, currentJson));
	}
	if (inputs.currentDocument !== inputs.expectedDocument) {
		differences.push(
			difference(inputs.documentPath, inputs.expectedDocument, inputs.currentDocument)
		);
	}
	return differences;
}

function rollbackCommittedDocument(
	absoluteDocument: string,
	previousDocument: string,
	error: unknown
): void {
	try {
		const rollback = stageAtomic(absoluteDocument, previousDocument);
		renameSync(rollback, absoluteDocument);
	} catch (rollbackError) {
		throw new Error(
			`Inventory publication failed and document rollback failed: ${String(error)}; ${String(rollbackError)}`
		);
	}
}

function assertBaselineUnchangedAfterFailure(
	absoluteBaseline: string,
	currentJson: string | null,
	json: string,
	error: unknown
): void {
	// A baseline rename is the final operation; before it succeeds the old baseline remains intact.
	if (
		currentJson === null &&
		existsSync(absoluteBaseline) &&
		readFileSync(absoluteBaseline, 'utf8') !== json
	) {
		throw new Error(
			`Inventory publication failed with an unexpected baseline state: ${String(error)}`
		);
	}
}

function discardStagedFiles(temporaries: readonly (string | null)[]): void {
	for (const temporary of temporaries) {
		if (temporary && existsSync(temporary)) unlinkSync(temporary);
	}
}

export function runInventory(options: RunInventoryOptions): RunInventoryResult {
	const repositoryRoot = resolve(options.repositoryRoot);
	const documentPath = DEFAULT_DOCUMENT_PATH;
	const baselinePath = DEFAULT_BASELINE_PATH;
	const inventory = collectInventory({
		repositoryRoot,
		requireJpwbPopulations: options.requireJpwbPopulations
	});
	const json = canonicalJson(inventory);
	if (options.mode === 'json') {
		return {
			differences: [],
			inventory,
			json,
			mode: options.mode,
			ok: true,
			subjectId: inventory.subject.subjectId
		};
	}
	const absoluteDocument = resolve(repositoryRoot, documentPath);
	const absoluteBaseline = resolve(repositoryRoot, baselinePath);
	if (!existsSync(absoluteDocument))
		throw new Error(`JAN-CSAA-005 document is absent: ${documentPath}`);
	const currentDocument = readFileSync(absoluteDocument, 'utf8');
	const expectedDocument = replaceGeneratedRegion(
		currentDocument,
		renderInventoryMarkdown(inventory)
	);
	validateProducts(inventory, json, expectedDocument);

	if (options.mode === 'check') {
		const differences = collectCheckDifferences({
			absoluteBaseline,
			baselinePath,
			currentDocument,
			documentPath,
			expectedDocument,
			json
		});
		return {
			differences,
			inventory,
			json,
			mode: options.mode,
			ok: differences.length === 0,
			subjectId: inventory.subject.subjectId
		};
	}

	const currentJson = readBaselineIfPresent(absoluteBaseline);
	let stagedBaseline: string | null = null;
	let stagedDocument: string | null = null;
	let documentCommitted = false;
	try {
		stagedBaseline = stageAtomic(absoluteBaseline, json);
		stagedDocument = stageAtomic(absoluteDocument, expectedDocument);
		// The controlled document commits first. If the second commit is interrupted, check mode rejects the pair;
		// a synchronous failure is rolled back below and a later write deterministically recovers hard interruption.
		renameSync(stagedDocument, absoluteDocument);
		stagedDocument = null;
		documentCommitted = true;
		options.afterFirstCommit?.();
		renameSync(stagedBaseline, absoluteBaseline);
		stagedBaseline = null;
	} catch (error) {
		if (documentCommitted) {
			rollbackCommittedDocument(absoluteDocument, currentDocument, error);
			documentCommitted = false;
		}
		assertBaselineUnchangedAfterFailure(absoluteBaseline, currentJson, json, error);
		throw error;
	} finally {
		discardStagedFiles([stagedBaseline, stagedDocument]);
	}
	return {
		differences: [],
		inventory,
		json,
		mode: options.mode,
		ok: true,
		subjectId: inventory.subject.subjectId
	};
}
