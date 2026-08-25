import { describe, expect, it } from 'vitest';

import { exclusionForDirectory } from './policy.js';

describe('subject directory exclusion policy', () => {
	it('admits only the exact authored CSAA coverage-provider source directory', () => {
		expect(exclusionForDirectory('coverage', 'packages/csaa/src/providers/coverage')).toBeNull();
		expect(exclusionForDirectory('coverage', 'coverage')).toMatchObject({
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT'
		});
		expect(exclusionForDirectory('coverage', 'apps/rph-demo/coverage')).toMatchObject({
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT'
		});
		expect(
			exclusionForDirectory('coverage', 'packages/csaa/src/providers/other/coverage')
		).toMatchObject({
			policyId: 'jan-csaa-exclude-build/1',
			primaryClass: 'BUILD_OUTPUT'
		});
	});
});
