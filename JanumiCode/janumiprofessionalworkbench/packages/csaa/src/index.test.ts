import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
	MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION,
	MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	buildModuleDependencyGraph,
	buildStaticSemanticSnapshot,
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	validateModuleDependencyGraph,
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
	it('exports the DWP-003 semantic and bounded DWP-004 module-graph surfaces', () => {
		expect(buildModuleDependencyGraph).toBeTypeOf('function');
		expect(buildStaticSemanticSnapshot).toBeTypeOf('function');
		expect(validateModuleDependencyGraph).toBeTypeOf('function');
		expect(validateStaticSemanticSnapshot).toBeTypeOf('function');
		expect(canonicalSemanticJson).toBeTypeOf('function');
		expect(canonicalSemanticJsonWitness).toBeTypeOf('function');
		expect(SEMANTIC_EXTRACTION_VERSION).toBe('jan-csaa-typescript-static/0.7.0');
		expect(SEMANTIC_OPERATION_VERSION).toBe('jan-csaa-build-static-semantic-snapshot/4.0.0');
		expect(SEMANTIC_REQUEST_SCHEMA_VERSION).toBe('jan-csaa-semantic-request/3.0.0');
		expect(SEMANTIC_SNAPSHOT_SCHEMA_VERSION).toBe('jan-csaa-semantic-snapshot/7.0.0');
		expect(TYPESCRIPT_PROVIDER_VERSION).toBe('5.9.3');
		expect(MODULE_DEPENDENCY_GRAPH_OPERATION_VERSION).toBe(
			'jan-csaa-build-module-dependency-graph/0.1.0'
		);
		expect(MODULE_DEPENDENCY_GRAPH_REQUEST_SCHEMA_VERSION).toBe(
			'jan-csaa-module-dependency-graph-request/1.0.0'
		);
		expect(MODULE_DEPENDENCY_GRAPH_SCHEMA_VERSION).toBe('jan-csaa-module-dependency-graph/1.0.0');
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
