import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import {
	CompilerInputCaptureError,
	createVerifiedCompilerProjectInputLookupSet,
	type VerifiedCompilerCapture,
	type VerifiedCompilerProjectInputProjectionBinding,
	type VerifiedCompilerProjectInputLookup
} from '../providers/typescript/compiler-input-journal.js';
import { canonicalSemanticJson } from './canonical.js';

interface StaticSemanticCompilerCaptureState {
	readonly projectLookups: ReadonlyMap<string, VerifiedCompilerProjectInputLookup>;
}

const STATIC_SEMANTIC_COMPILER_CAPTURES = new WeakMap<object, StaticSemanticCompilerCaptureState>();

function fail(message: string): never {
	throw new CompilerInputCaptureError('INVALID_CAPTURE', message);
}

function canonicalPaths(values: readonly string[]): string {
	return canonicalSemanticJson([...values].sort());
}

/**
 * @internal Attaches verified compiler inputs to the exact final in-memory snapshot object.
 * Serialization and structured cloning intentionally do not carry this capability.
 */
export function attachVerifiedCompilerCaptureToStaticSemanticSnapshot(
	snapshot: StaticSemanticSnapshot,
	subject: FrozenSubject,
	capture: VerifiedCompilerCapture
): void {
	if (STATIC_SEMANTIC_COMPILER_CAPTURES.has(snapshot))
		fail('Static semantic snapshot already has a verified compiler capture capability.');
	if (!Object.isFrozen(snapshot))
		fail('Verified compiler capture may attach only to the final frozen semantic snapshot.');
	const snapshotPaths = snapshot.projects.map((project) => project.configPath);
	const subjectPaths = subject.projects.map((project) => project.configPath);
	const attributionPaths = capture.projectAttributions.map((attribution) => attribution.projectKey);
	if (
		canonicalPaths(snapshotPaths) !== canonicalPaths(subjectPaths) ||
		canonicalPaths(snapshotPaths) !== canonicalPaths(attributionPaths) ||
		snapshot.programs.length !== snapshot.projects.length
	)
		fail('Semantic snapshot, FrozenSubject, and verified compiler project populations differ.');

	const subjectProjectsByPath = new Map(
		subject.projects.map((project) => [project.configPath, project] as const)
	);
	const attributionsByPath = new Map(
		capture.projectAttributions.map((attribution) => [attribution.projectKey, attribution] as const)
	);
	const programsById = new Map(snapshot.programs.map((program) => [program.id, program] as const));
	const projectBindings: VerifiedCompilerProjectInputProjectionBinding[] = [];
	for (const project of snapshot.projects) {
		const subjectProject = subjectProjectsByPath.get(project.configPath);
		const attribution = attributionsByPath.get(project.configPath);
		const program = programsById.get(project.programId);
		if (
			subjectProject === undefined ||
			attribution === undefined ||
			program === undefined ||
			program.projectId !== project.id ||
			project.programRecipe.configPath !== project.configPath ||
			canonicalSemanticJson(project.programRecipe) !==
				canonicalSemanticJson(subjectProject.programRecipe)
		)
			fail(
				`Semantic project does not reproduce its exact subject recipe and Program: ${project.configPath}.`
			);
		projectBindings.push({
			configPath: project.configPath,
			contextInputIds: project.contextInputIds,
			materializedRecipeDigest: attribution.materializedRecipeDigest,
			programContextDigest: program.contextDigest,
			projectResolutionDigest: project.programRecipe.projectResolutionDigest
		});
	}
	const projectLookups = new Map<string, VerifiedCompilerProjectInputLookup>();
	for (const entry of createVerifiedCompilerProjectInputLookupSet(subject, capture, {
		compilerInputs: snapshot.compilerInputs,
		contextDigest: snapshot.contextDigest,
		projects: projectBindings,
		subjectId: snapshot.subjectId
	}))
		projectLookups.set(entry.configPath, entry.lookup);
	STATIC_SEMANTIC_COMPILER_CAPTURES.set(snapshot, Object.freeze({ projectLookups }));
}

/** @internal Returns a lookup only for the exact attached snapshot object and config path. */
export function getStaticSemanticSnapshotCompilerProjectInputLookup(
	snapshot: StaticSemanticSnapshot,
	configPath: string
): VerifiedCompilerProjectInputLookup | undefined {
	return STATIC_SEMANTIC_COMPILER_CAPTURES.get(snapshot)?.projectLookups.get(configPath);
}
