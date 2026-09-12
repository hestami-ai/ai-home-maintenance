import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256 } from '../inventory/canonical.js';
import {
	CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH,
	CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REVIEWED_DIGEST,
	CURRENT_DEPENDENCY_CRUISER_HISTORICAL_DIFFERENTIAL_DIGEST,
	CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST,
	type CurrentDependencyCruiserDifferentialEvidence
} from './run-current-dependency-cruiser-differential.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function json(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as Record<string, unknown>;
}

describe('current dependency-cruiser differential repository integration', () => {
	it('exposes explicit check/write commands without granting gate authority', () => {
		const rootPackage = json('package.json');
		const packageManifest = json('packages/csaa/package.json');
		const rootScripts = rootPackage.scripts as Record<string, string>;
		const packageScripts = packageManifest.scripts as Record<string, string>;
		expect(rootScripts).toMatchObject({
			'csaa:dependency-cruiser-differential':
				'bun scripts/csaa-dependency-cruiser-differential.ts --write',
			'csaa:dependency-cruiser-differential:check':
				'bun scripts/csaa-dependency-cruiser-differential.ts --check'
		});
		expect(packageScripts).toMatchObject({
			'dependency-cruiser-differential':
				'bun ../../scripts/csaa-dependency-cruiser-differential.ts --write',
			'dependency-cruiser-differential:check':
				'bun ../../scripts/csaa-dependency-cruiser-differential.ts --check'
		});
		expect(rootScripts.gate).not.toContain('dependency-cruiser-differential');
		expect(rootScripts['gate:fast']).not.toContain('dependency-cruiser-differential');
		const readme = readFileSync(resolve(ROOT, 'packages/csaa/README.md'), 'utf8');
		const runnerScript = readFileSync(
			resolve(ROOT, 'scripts/csaa-dependency-cruiser-differential.ts'),
			'utf8'
		);
		expect(runnerScript).toContain('--g4-write');
		expect(runnerScript).toContain('--g4-check');
		expect(runnerScript).toContain('--g4-json');
		expect(runnerScript).toContain('currentDependencyCruiserEvidenceDigestsAreValid');
		expect(runnerScript).not.toContain('differentialContentDigest');
		expect(readme).toContain('### Reviewed partial dependency-cruiser differential');
		expect(readme).toContain(CURRENT_DEPENDENCY_CRUISER_HISTORICAL_DIFFERENTIAL_DIGEST);
		expect(readme).toContain(CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST);
		expect(readme).toContain(CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_REVIEWED_DIGEST);
		expect(readme).toContain('Compiler/provider context equivalence remains `UNKNOWN`');
		expect(readme).toContain('negative coverage remains open');
		expect(readme).toContain('does not establish repository-wide compiler/provider equivalence');
		expect(readme).toContain('### Exact build-root same-perimeter G4 closure');
		expect(readme).toContain('bun scripts/csaa-dependency-cruiser-differential.ts --g4-json');
		expect(readme).toContain('bun scripts/csaa-dependency-cruiser-differential.ts --g4-check');
		expect(readme).toContain('bun scripts/csaa-dependency-cruiser-differential.ts --g4-write');
		expect(readme).toContain('CLOSED_FOR_EXACT_BUILD_ROOT_AND_REPRESENTED_RELATION_POPULATIONS');
		expect(readme).toContain(
			'underlying v1 comparison deliberately retains negative coverage `OPEN`'
		);
	});

	it('retains the exact reviewed partial evidence boundary', () => {
		const text = readFileSync(resolve(ROOT, CURRENT_DEPENDENCY_CRUISER_EVIDENCE_PATH), 'utf8');
		const evidence = JSON.parse(text) as CurrentDependencyCruiserDifferentialEvidence;
		expect(text).toBe(canonicalJson(evidence));
		const { contentDigest, ...withoutDigest } = evidence;
		expect(contentDigest).toBe(sha256(canonicalJson(withoutDigest)));
		expect(evidence).toMatchObject({
			analysisAuthority: 'NONE',
			capabilityStatus: 'PARTIAL',
			currentness: {
				checkedAfterProviderExecution: true,
				checkedAtFinalEvidenceBoundary: true,
				state: 'CURRENT_FOR_CAPTURED_SUBJECT_AT_PROVIDER_AND_FINAL_BOUNDARIES'
			},
			differential: {
				acceptanceState: 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL',
				authority: 'REVIEWED_DIFFERENTIAL_EVIDENCE_ONLY',
				coverage: {
					comparisonRecords: 4_781,
					compilerEdges: 34,
					dependencyCruiserDependencies: 4_825,
					observedDifferenceRecords: 0,
					providerModules: 940,
					reconciles: true
				},
				differentialDigest: CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST,
				gateEffect: 'NONE',
				observation: {
					limitations: [
						'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED',
						'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY',
						'SUMMARY_VIOLATIONS_DIGEST_ONLY'
					]
				}
			},
			gateEffect: 'NONE',
			graph: { edges: 34, reconciles: true },
			reviewedBaseline: {
				expectedDifferentialDigest: CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST,
				state: 'EXACT_MATCH'
			},
			semanticSnapshot: { projectionBoundary: 'EXACT_ONE_PROJECT_RPH_CONTRACTS_BUILD_SLICE' },
			subject: { projectPaths: ['packages/rph-contracts/tsconfig.build.json'] }
		});
		expect(evidence.provider.inputPaths).toEqual(['apps', 'packages']);
		const generated = /(^|\/)\.svelte-kit\//u;
		expect(
			evidence.differential.comparison.records.some(
				(record) =>
					generated.test(record.key.sourcePath) ||
					record.dependencyCruiser.targetLogicalPaths.some((path) => generated.test(path))
			)
		).toBe(false);
		expect(evidence.differential.comparison).toMatchObject({
			coverage: {
				agreementRecords: 24,
				corroborationRecords: 1,
				incomparableRecords: 4_756,
				observedDifferenceRecords: 0,
				recordCount: 4_781,
				reconciles: true
			},
			negativeCoverage: { state: 'OPEN' },
			resolutionContext: { state: 'UNKNOWN' }
		});
		expect(evidence.nonclaims).toEqual(
			expect.arrayContaining([
				'COMPILER_PROVIDER_PERIMETER_EQUIVALENCE',
				'G4_PASS',
				'NEGATIVE_COVERAGE_CLOSED',
				'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION',
				'REPOSITORY_GATE_AUTHORITY',
				'WHOLE_APPS_PACKAGES_COMPILER_CLOSURE'
			])
		);
	});
});
