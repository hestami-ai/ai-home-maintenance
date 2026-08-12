import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
	CALL_GRAPH_OPERATION_VERSION,
	CALL_GRAPH_REQUEST_SCHEMA_VERSION,
	CALL_GRAPH_SCHEMA_VERSION,
	READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION,
	READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_PROGRESS_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_OPERATION_VERSION,
	STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION,
	STATE_MACHINE_GRAPH_SCHEMA_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION,
	STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	buildCallGraph,
	buildReadWriteAccessGraph,
	buildArrowCommandCensusArtifactSet,
	buildModuleDependencyGraph,
	buildStateMachineGraph,
	buildStaticSemanticSnapshot,
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	compareDependencyProviders,
	normalizeDependencyCruiserOutput,
	observeStateMachineTopology,
	observeArrowCommandCensus,
	validateDependencyCruiserObservation,
	validateDependencyProviderComparison,
	validateCallGraph,
	validateReadWriteAccessGraph,
	validateArrowCommandCensusArtifactSet,
	validateArrowCommandCensusObservation,
	validateModuleDependencyGraph,
	validateStateMachineGraph,
	validateStateMachineTopologyObservation,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

interface PackageManifest {
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
}

function manifest(relativeUrl: string): PackageManifest {
	return JSON.parse(readFileSync(new URL(relativeUrl, import.meta.url), 'utf8')) as PackageManifest;
}

describe('@janumipwb/csaa public semantic and graph surface', () => {
	it('exports the DWP-003 semantic and bounded DWP-004 graph surfaces', () => {
		expect(buildCallGraph).toBeTypeOf('function');
		expect(buildReadWriteAccessGraph).toBeTypeOf('function');
		expect(buildArrowCommandCensusArtifactSet).toBeTypeOf('function');
		expect(buildModuleDependencyGraph).toBeTypeOf('function');
		expect(buildStateMachineGraph).toBeTypeOf('function');
		expect(buildStaticSemanticSnapshot).toBeTypeOf('function');
		expect(compareDependencyProviders).toBeTypeOf('function');
		expect(normalizeDependencyCruiserOutput).toBeTypeOf('function');
		expect(observeStateMachineTopology).toBeTypeOf('function');
		expect(observeArrowCommandCensus).toBeTypeOf('function');
		expect(validateDependencyCruiserObservation).toBeTypeOf('function');
		expect(validateDependencyProviderComparison).toBeTypeOf('function');
		expect(validateCallGraph).toBeTypeOf('function');
		expect(validateReadWriteAccessGraph).toBeTypeOf('function');
		expect(validateArrowCommandCensusArtifactSet).toBeTypeOf('function');
		expect(validateArrowCommandCensusObservation).toBeTypeOf('function');
		expect(validateModuleDependencyGraph).toBeTypeOf('function');
		expect(validateStateMachineGraph).toBeTypeOf('function');
		expect(validateStateMachineTopologyObservation).toBeTypeOf('function');
		expect(validateStaticSemanticSnapshot).toBeTypeOf('function');
		expect(canonicalSemanticJson).toBeTypeOf('function');
		expect(canonicalSemanticJsonWitness).toBeTypeOf('function');
		expect(SEMANTIC_EXTRACTION_VERSION).toBe('jan-csaa-typescript-static/0.7.0');
		expect(SEMANTIC_OPERATION_VERSION).toBe('jan-csaa-build-static-semantic-snapshot/4.0.0');
		expect(SEMANTIC_REQUEST_SCHEMA_VERSION).toBe('jan-csaa-semantic-request/3.0.0');
		expect(SEMANTIC_SNAPSHOT_SCHEMA_VERSION).toBe('jan-csaa-semantic-snapshot/7.0.0');
		expect(TYPESCRIPT_PROVIDER_VERSION).toBe('5.9.3');
		expect(CALL_GRAPH_OPERATION_VERSION).toBe('jan-csaa-build-call-graph/0.1.0');
		expect(CALL_GRAPH_REQUEST_SCHEMA_VERSION).toBe('jan-csaa-call-graph-request/1.0.0');
		expect(CALL_GRAPH_SCHEMA_VERSION).toBe('jan-csaa-call-graph/1.0.0');
		expect(READ_WRITE_ACCESS_GRAPH_OPERATION_VERSION).toBe(
			'jan-csaa-build-read-write-access-graph/0.1.0'
		);
		expect(READ_WRITE_ACCESS_GRAPH_REQUEST_SCHEMA_VERSION).toBe(
			'jan-csaa-read-write-access-graph-request/1.0.0'
		);
		expect(READ_WRITE_ACCESS_GRAPH_SCHEMA_VERSION).toBe('jan-csaa-read-write-access-graph/1.0.0');
		expect(ARROW_COMMAND_CENSUS_OPERATION_VERSION).toBe(
			'jan-csaa-observe-jpwb-arrow-command-census/0.1.0'
		);
		expect(ARROW_COMMAND_CENSUS_OBSERVATION_SCHEMA_VERSION).toBe(
			'jan-csaa-arrow-command-census-observation/1.0.0'
		);
		expect(ARROW_COMMAND_CENSUS_PROGRESS_SCHEMA_VERSION).toBe(
			'jan-csaa-arrow-command-census-progress/1.0.0'
		);
		expect(STATE_MACHINE_TOPOLOGY_OBSERVATION_OPERATION_VERSION).toBe(
			'jan-csaa-observe-jpwb-state-machine-topology/0.1.0'
		);
		expect(STATE_MACHINE_TOPOLOGY_OBSERVATION_SCHEMA_VERSION).toBe(
			'jan-csaa-state-machine-topology-observation/1.0.0'
		);
		expect(STATE_MACHINE_GRAPH_OPERATION_VERSION).toBe('jan-csaa-build-state-machine-graph/0.1.0');
		expect(STATE_MACHINE_GRAPH_REQUEST_SCHEMA_VERSION).toBe(
			'jan-csaa-state-machine-graph-request/1.0.0'
		);
		expect(STATE_MACHINE_GRAPH_SCHEMA_VERSION).toBe('jan-csaa-state-machine-graph/1.0.0');
		expect(MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION).toBe(
			'jan-csaa-build-module-dependency-graph/0.1.0'
		);
		expect(MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION).toBe(
			'jan-csaa-module-dependency-graph-request/1.0.0'
		);
		expect(MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION).toBe('jan-csaa-module-dependency-graph/1.0.0');
		expect(DEPENDENCY_CRUISER_PROVIDER_VERSION).toBe('16.10.4');
		expect(DEPENDENCY_CRUISER_NORMALIZATION_OPERATION_VERSION).toBe(
			'jan-csaa-normalize-dependency-cruiser-output/0.1.0'
		);
		expect(DEPENDENCY_PROVIDER_COMPARISON_OPERATION_VERSION).toBe(
			'jan-csaa-compare-dependency-providers/0.1.0'
		);
	});

	it('pins the provider version exactly at runtime and every repository declaration site', () => {
		const root = manifest('../../../package.json');
		const csaa = manifest('../package.json');
		const app = manifest('../../../apps/rph-demo/package.json');
		expect(ts.version).toBe(TYPESCRIPT_PROVIDER_VERSION);
		expect(root.devDependencies?.typescript).toBe(TYPESCRIPT_PROVIDER_VERSION);
		expect(app.devDependencies?.typescript).toBe(TYPESCRIPT_PROVIDER_VERSION);
		expect(csaa.dependencies?.typescript).toBe(TYPESCRIPT_PROVIDER_VERSION);
		expect(csaa.devDependencies?.typescript).toBeUndefined();
	});
});
