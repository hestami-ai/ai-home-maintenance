import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import {
	cleanupProviderFixtures,
	providerFixture
} from '../runtime/provider-evidence.test-support.js';
import { observeJpwbNativeSecurity } from './observe-jpwb-security.js';

afterEach(cleanupProviderFixtures);

describe('bounded native JPWB security observations', () => {
	it('detects three evidence-supported risky syntax surfaces without retaining source or conferring authority', () => {
		const risky = {
			'packages/demo/src/process.ts':
				"import { exec, spawn } from 'node:child_process';\nexec(userCommand);\nspawn('safe', [], { shell: false });\nconsole.error(process.env.API_TOKEN);\n",
			'packages/demo/src/server/workbench.ts':
				"export function principal() { return { principalKind: 'HUMAN', id: 'fabricated' }; }\n"
		};
		const fixture = providerFixture(risky);
		const result = observeJpwbNativeSecurity({
			observedAt: '2026-08-25T12:00:02.000Z',
			repositoryRoot: fixture.root,
			sources: Object.entries(risky).map(([path, source]) => ({ path, source })),
			subject: fixture.subject
		});
		expect(result).toMatchObject({
			analysisAuthority: 'NONE',
			coverage: { state: 'COMPLETE' },
			freshness: 'CURRENT',
			gateEffect: 'NONE',
			health: 'HEALTHY'
		});
		expect(result.findings.map((finding) => finding.ruleId).sort()).toEqual([
			'JPWB-SEC-001_UNBOUND_HUMAN_PRINCIPAL_CONSTRUCTION',
			'JPWB-SEC-002_SHELL_ENABLED_PROCESS_EXECUTION',
			'JPWB-SEC-003_SECRET_BEARING_DIAGNOSTIC_ARGUMENT'
		]);
		expect(JSON.stringify(result)).not.toContain('API_TOKEN');
	});

	it('discriminates authenticated identity, argument-vector execution, and non-secret logging controls', () => {
		const safe = {
			'packages/demo/src/server/workbench.ts':
				"import { spawn } from 'node:child_process';\nconst identity = requireAuthenticatedIdentity();\nspawn('tool', ['--json'], { shell: false });\nconsole.info(identity.id);\nexport const principal = { principalKind: 'HUMAN' };\n"
		};
		const fixture = providerFixture(safe);
		const result = observeJpwbNativeSecurity({
			observedAt: '2026-08-25T12:00:02.000Z',
			repositoryRoot: fixture.root,
			sources: Object.entries(safe).map(([path, source]) => ({ path, source })),
			subject: fixture.subject
		});
		expect(result).toMatchObject({ coverage: { state: 'COMPLETE' }, health: 'HEALTHY' });
		expect(result.findings).toEqual([]);
		expect(result.limitations).toContain('NO_FINDING_IS_NOT_NO_VULNERABILITY');
	});

	it('reports partial population, refuses mismatched supplied bytes, and does not reuse stale subjects', () => {
		const sources = {
			'packages/demo/src/a.ts': 'export const a = 1;\n',
			'packages/demo/src/b.ts': 'export const b = 2;\n'
		};
		const fixture = providerFixture(sources);
		const partial = observeJpwbNativeSecurity({
			observedAt: '2026-08-25T12:00:02.000Z',
			repositoryRoot: fixture.root,
			sources: [{ path: 'packages/demo/src/a.ts', source: sources['packages/demo/src/a.ts'] }],
			subject: fixture.subject
		});
		expect(partial).toMatchObject({
			coverage: { missingEligiblePaths: ['packages/demo/src/b.ts'], state: 'PARTIAL' },
			health: 'HEALTHY'
		});
		const malformed = observeJpwbNativeSecurity({
			observedAt: '2026-08-25T12:00:02.000Z',
			repositoryRoot: fixture.root,
			sources: [{ path: 'packages/demo/src/a.ts', source: 'different bytes\n' }],
			subject: fixture.subject
		});
		expect(malformed).toMatchObject({ findings: [], health: 'MALFORMED' });
		const invalidUnicodeSource = 'export const value = "\ud800";\n';
		const invalidUnicodeFixture = providerFixture({
			'packages/demo/src/invalid-unicode.ts': invalidUnicodeSource
		});
		const invalidUnicode = observeJpwbNativeSecurity({
			observedAt: '2026-08-25T12:00:02.000Z',
			repositoryRoot: invalidUnicodeFixture.root,
			sources: [{ path: 'packages/demo/src/invalid-unicode.ts', source: invalidUnicodeSource }],
			subject: invalidUnicodeFixture.subject
		});
		expect(invalidUnicode).toMatchObject({ findings: [], health: 'MALFORMED' });
		writeFileSync(join(fixture.root, 'packages/demo/src/a.ts'), 'export const a = 3;\n', 'utf8');
		const stale = observeJpwbNativeSecurity({
			observedAt: '2026-08-25T12:00:03.000Z',
			repositoryRoot: fixture.root,
			sources: Object.entries(sources).map(([path, source]) => ({ path, source })),
			subject: fixture.subject
		});
		expect(stale).toMatchObject({ findings: [], freshness: 'STALE', health: 'STALE' });
	});
});
