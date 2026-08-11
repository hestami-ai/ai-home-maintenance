import type { SubjectDiagnostic, WorkspaceSubjectRecord } from '../contracts/subject.js';
import type { SubjectCapture } from './capture-model.js';
import { globMatches } from './policy.js';

export interface WorkspaceDiscovery {
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly workspaces: readonly WorkspaceSubjectRecord[];
}

export class WorkspaceDiscoveryFailure extends Error {
	constructor(readonly outcome: 'ambiguous' | 'incompatible' | 'not-found' = 'incompatible') {
		super();
	}
}

interface PackageManifest {
	readonly exports?: unknown;
	readonly name?: unknown;
	readonly private?: unknown;
	readonly workspaces?: unknown;
}

function parseManifest(capture: SubjectCapture, path: string): PackageManifest {
	const bytes = capture.bytesByPath.get(path);
	if (bytes === undefined) {
		const error = new WorkspaceDiscoveryFailure('not-found');
		error.message = `Required captured manifest is absent: ${path}`;
		throw error;
	}
	try {
		return JSON.parse(Buffer.from(bytes).toString('utf8')) as PackageManifest;
	} catch {
		const error = new WorkspaceDiscoveryFailure();
		error.message = `Workspace manifest is malformed: ${path}`;
		throw error;
	}
}

function rootPatterns(manifest: PackageManifest): string[] {
	if (Array.isArray(manifest.workspaces)) {
		if (!manifest.workspaces.every((value) => typeof value === 'string')) {
			const error = new WorkspaceDiscoveryFailure();
			error.message = 'Root workspace patterns must all be strings.';
			throw error;
		}
		const patterns = manifest.workspaces as string[];
		if (!patterns.every((value) => /^[^*?]+\/\*$/u.test(value))) {
			const error = new WorkspaceDiscoveryFailure();
			error.message =
				'Unsupported workspace pattern; DWP-002 accepts exact one-level member globs.';
			throw error;
		}
		return patterns;
	}
	if (
		manifest.workspaces !== null &&
		typeof manifest.workspaces === 'object' &&
		Array.isArray((manifest.workspaces as { packages?: unknown }).packages)
	) {
		const values = (manifest.workspaces as { packages: unknown[] }).packages;
		if (!values.every((value) => typeof value === 'string')) {
			const error = new WorkspaceDiscoveryFailure();
			error.message = 'Root workspace package patterns must all be strings.';
			throw error;
		}
		const patterns = values as string[];
		if (!patterns.every((value) => /^[^*?]+\/\*$/u.test(value))) {
			const error = new WorkspaceDiscoveryFailure();
			error.message =
				'Unsupported workspace pattern; DWP-002 accepts exact one-level member globs.';
			throw error;
		}
		return patterns;
	}
	if (manifest.workspaces === undefined) return [];
	const error = new WorkspaceDiscoveryFailure();
	error.message = 'Unsupported root workspaces declaration.';
	throw error;
}

function exportRecords(value: unknown): WorkspaceSubjectRecord['exports'] {
	const records: { conditions: string[]; exportName: string; target: string | null }[] = [];
	const visit = (child: unknown, exportName: string, conditions: string[]): void => {
		if (typeof child === 'string' || child === null) {
			records.push({ conditions, exportName, target: child });
			return;
		}
		if (Array.isArray(child)) {
			child.forEach((entry, index) => visit(entry, exportName, [...conditions, `[${index}]`]));
			return;
		}
		if (child !== null && typeof child === 'object') {
			for (const [key, entry] of Object.entries(child as Record<string, unknown>).sort(
				([left], [right]) => (left < right ? -1 : 1)
			)) {
				if (key.startsWith('.')) visit(entry, key, conditions);
				else visit(entry, exportName, [...conditions, key]);
			}
		}
	};
	if (value !== undefined) visit(value, '.', []);
	return records.sort((left, right) =>
		`${left.exportName}:${left.conditions.join('/')}:${left.target ?? ''}` <
		`${right.exportName}:${right.conditions.join('/')}:${right.target ?? ''}`
			? -1
			: 1
	);
}

export function discoverWorkspaces(capture: SubjectCapture): WorkspaceDiscovery {
	const patterns = rootPatterns(parseManifest(capture, 'package.json'));
	const workspaces: WorkspaceSubjectRecord[] = [];
	const names = new Map<string, string>();
	const memberPaths = capture.directoryPaths
		.filter((path) => patterns.some((pattern) => globMatches(path, pattern)))
		.sort();
	for (const pattern of patterns) {
		if (!memberPaths.some((path) => globMatches(path, pattern))) {
			const error = new WorkspaceDiscoveryFailure('not-found');
			error.message = `Workspace pattern has no captured member: ${pattern}`;
			throw error;
		}
	}
	for (const path of memberPaths) {
		const manifestPath = `${path}/package.json`;
		if (!capture.bytesByPath.has(manifestPath)) {
			const error = new WorkspaceDiscoveryFailure('not-found');
			error.message = `Workspace member has no captured package.json: ${path}`;
			throw error;
		}
		const matchingPatterns = patterns.filter((pattern) => globMatches(path, pattern));
		const manifest = parseManifest(capture, manifestPath);
		if (
			typeof manifest.name !== 'string' ||
			!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(manifest.name) ||
			(manifest.private !== undefined && typeof manifest.private !== 'boolean')
		) {
			const error = new WorkspaceDiscoveryFailure();
			error.message = `Workspace manifest has invalid name/private fields: ${manifestPath}`;
			throw error;
		}
		const prior = names.get(manifest.name);
		if (prior !== undefined) {
			const error = new WorkspaceDiscoveryFailure('ambiguous');
			error.message = `Workspace name ${manifest.name} is ambiguous between ${prior} and ${manifestPath}.`;
			throw error;
		}
		names.set(manifest.name, manifestPath);
		workspaces.push({
			exports: exportRecords(manifest.exports),
			kind: path.startsWith('apps/') ? 'APP' : 'PACKAGE',
			manifestPath,
			name: manifest.name,
			path,
			private: manifest.private === true,
			provenance: ['package.json#workspaces', manifestPath],
			workspacePatterns: matchingPatterns.sort()
		});
	}
	return {
		diagnostics: [],
		workspaces: workspaces.sort((left, right) => (left.path < right.path ? -1 : 1))
	};
}

export function workspacePathByName(
	workspaces: readonly WorkspaceSubjectRecord[]
): ReadonlyMap<string, string> {
	return new Map(workspaces.map((workspace) => [workspace.name, workspace.path]));
}
