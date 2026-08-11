import type { SemanticPopulationKind, SemanticPopulationRecord } from '../contracts/semantic.js';
import { canonicalSemanticJsonWitness } from './canonical.js';

export interface SemanticPopulationMembers {
	readonly analyzed: readonly string[];
	readonly contextOnly: readonly string[];
	readonly excluded: readonly string[];
	readonly excludedByPolicy: readonly string[];
	readonly failed: readonly string[];
	readonly unknown: readonly string[];
	readonly unsupported: readonly string[];
}

function sortedUnique(values: readonly string[]): readonly string[] | null {
	let canonical = true;
	for (let index = 1; index < values.length; index += 1) {
		if (values[index - 1] === values[index]) return null;
		if (values[index - 1]! > values[index]!) canonical = false;
	}
	const sorted = canonical ? values : [...values].sort();
	for (let index = 1; index < sorted.length; index += 1)
		if (sorted[index - 1] === sorted[index]) return null;
	return sorted;
}

function isSubset(subset: readonly string[], superset: readonly string[]): boolean {
	const available = new Set(superset);
	return subset.every((value) => available.has(value));
}

function areDisjoint(left: readonly string[], right: readonly string[]): boolean {
	const leftMembers = new Set(left);
	return right.every((value) => !leftMembers.has(value));
}

function union(...sets: readonly (readonly string[])[]): readonly string[] | null {
	const nonEmpty = sets.filter((set) => set.length > 0);
	if (nonEmpty.length === 0) return [];
	if (nonEmpty.length === 1) return nonEmpty[0]!;
	return sortedUnique(nonEmpty.flatMap((set) => [...set]));
}

function digest(values: readonly string[]): string {
	return canonicalSemanticJsonWitness(values).sha256;
}

export function semanticPopulation(
	kind: SemanticPopulationKind,
	members: SemanticPopulationMembers,
	expectedZero = false
): SemanticPopulationRecord {
	const normalized = Object.fromEntries(
		Object.entries(members).map(([name, values]) => [name, sortedUnique(values)])
	) as Record<keyof SemanticPopulationMembers, readonly string[] | null>;
	const includedUnion =
		normalized.analyzed && normalized.contextOnly
			? union(normalized.analyzed, normalized.contextOnly)
			: null;
	const discoveredUnion =
		includedUnion && normalized.excluded && normalized.failed
			? union(includedUnion, normalized.excluded, normalized.failed)
			: null;
	const allUnique = Object.values(normalized).every((values) => values !== null);
	const reconciles =
		allUnique &&
		includedUnion !== null &&
		discoveredUnion !== null &&
		normalized.excludedByPolicy !== null &&
		normalized.excluded !== null &&
		isSubset(normalized.excludedByPolicy, normalized.excluded) &&
		normalized.unsupported !== null &&
		normalized.unknown !== null &&
		normalized.analyzed !== null &&
		isSubset(normalized.unsupported, normalized.analyzed) &&
		isSubset(normalized.unknown, normalized.analyzed) &&
		areDisjoint(normalized.unsupported, normalized.unknown) &&
		normalized.excluded !== null &&
		normalized.failed !== null &&
		areDisjoint(includedUnion, normalized.excluded) &&
		areDisjoint(includedUnion, normalized.failed) &&
		areDisjoint(normalized.excluded, normalized.failed) &&
		(!expectedZero || discoveredUnion.length === 0);
	const safe = Object.fromEntries(
		Object.entries(normalized).map(([name, values]) => [name, values ?? []])
	) as unknown as Record<keyof SemanticPopulationMembers, readonly string[]>;
	const safeIncluded = includedUnion ?? [];
	const safeDiscovered = discoveredUnion ?? [];
	const analyzedManifest = digest(safe.analyzed);
	const contextOnlyManifest = digest(safe.contextOnly);
	const includedManifest =
		safeIncluded === safe.analyzed
			? analyzedManifest
			: safeIncluded === safe.contextOnly
				? contextOnlyManifest
				: digest(safeIncluded);
	const discoveredManifest =
		safeDiscovered === safeIncluded ? includedManifest : digest(safeDiscovered);
	return {
		analyzed: safe.analyzed.length,
		contextOnly: safe.contextOnly.length,
		discovered: safeDiscovered.length,
		excluded: safe.excluded.length,
		excludedByPolicy: safe.excludedByPolicy.length,
		expectedZero,
		failed: safe.failed.length,
		included: safeIncluded.length,
		kind,
		members: safe,
		manifests: {
			analyzed: analyzedManifest,
			contextOnly: contextOnlyManifest,
			discovered: discoveredManifest,
			excluded: digest(safe.excluded),
			excludedByPolicy: digest(safe.excludedByPolicy),
			failed: digest(safe.failed),
			included: includedManifest,
			unknown: digest(safe.unknown),
			unsupported: digest(safe.unsupported)
		},
		reconciles,
		unknown: safe.unknown.length,
		unsupported: safe.unsupported.length
	};
}
