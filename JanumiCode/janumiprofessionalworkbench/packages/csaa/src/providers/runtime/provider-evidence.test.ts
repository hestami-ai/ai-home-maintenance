import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '../../inventory/canonical.js';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from './provider-evidence.test-support.js';
import { importProviderJson } from './provider-evidence.js';

afterEach(cleanupProviderFixtures);

describe('shared enriched-provider evidence boundary', () => {
	it('rechecks live subject bytes after normalization and rejects a normalization-window race', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, 'fixture-provider');
		const result = importProviderJson({
			adapterId: 'fixture-adapter',
			adapterVersion: '1.0.0',
			context,
			expectedProviderId: 'fixture-provider',
			normalize: () => {
				writeFileSync(
					join(fixture.root, 'packages/demo/src/index.ts'),
					'export const value = 2;\n',
					'utf8'
				);
				return { completedRegions: ['fixture'], missingRegions: [], observations: ['observed'] };
			},
			raw: '{}',
			supportedProviderVersions: ['1.0.0']
		});
		expect(result).toMatchObject({
			freshness: { state: 'STALE' },
			health: 'HEALTHY',
			usableForCurrentSubject: false
		});
	});

	it('retains subject-identity disagreement without normalizing it into staleness or agreement', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, 'fixture-provider', {
			subjectManifestSha256: sha256('different-subject-manifest')
		});
		const result = importProviderJson({
			adapterId: 'fixture-adapter',
			adapterVersion: '1.0.0',
			context,
			expectedProviderId: 'fixture-provider',
			normalize: () => ({ completedRegions: ['fixture'], missingRegions: [], observations: [] }),
			raw: '{}',
			supportedProviderVersions: ['1.0.0']
		});
		expect(result).toMatchObject({
			conflicts: [{ code: 'SUBJECT_IDENTITY_MISMATCH' }],
			freshness: { state: 'UNKNOWN' },
			usableForCurrentSubject: false
		});
	});
});
