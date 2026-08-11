import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	buildStaticSemanticSnapshot,
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	validateStaticSemanticSnapshot
} from '@janumipwb/csaa';

interface PackageManifest {
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
}

function manifest(relativeUrl: string): PackageManifest {
	return JSON.parse(readFileSync(new URL(relativeUrl, import.meta.url), 'utf8')) as PackageManifest;
}

describe('@janumipwb/csaa public semantic surface', () => {
	it('exports the Slice 3A operation, validator, canonical serializer, and exact version identities', () => {
		expect(buildStaticSemanticSnapshot).toBeTypeOf('function');
		expect(validateStaticSemanticSnapshot).toBeTypeOf('function');
		expect(canonicalSemanticJson).toBeTypeOf('function');
		expect(canonicalSemanticJsonWitness).toBeTypeOf('function');
		expect(SEMANTIC_OPERATION_VERSION).toBe('jan-csaa-build-static-semantic-snapshot/1.0.0');
		expect(SEMANTIC_REQUEST_SCHEMA_VERSION).toBe('jan-csaa-semantic-request/1.0.0');
		expect(SEMANTIC_SNAPSHOT_SCHEMA_VERSION).toBe('jan-csaa-semantic-snapshot/2.0.0');
		expect(TYPESCRIPT_PROVIDER_VERSION).toBe('5.9.3');
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
