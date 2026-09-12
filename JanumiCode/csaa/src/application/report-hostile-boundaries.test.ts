import { afterEach, describe, expect, it, vi } from 'vitest';

interface ReportBoundaryCase {
	readonly exerciseAdmission: () => Promise<unknown>;
	readonly exerciseProgress?: () => Promise<unknown>;
	readonly name: string;
}

const reportCases: readonly ReportBoundaryCase[] = [
	{
		async exerciseAdmission() {
			const report = await import('./run-command-event-contract-overlay-report.js');
			return report.admitCommandEventContractOverlayReportRequest({});
		},
		async exerciseProgress() {
			const report = await import('./run-command-event-contract-overlay-report.js');
			return report.runCommandEventContractOverlayReport(null, { repositoryRoot: '.' });
		},
		name: 'command-event contract overlay'
	},
	{
		async exerciseAdmission() {
			const report = await import('./run-command-dispatch-topology-report.js');
			return report.admitCommandDispatchTopologyReportRequest({});
		},
		async exerciseProgress() {
			const report = await import('./run-command-dispatch-topology-report.js');
			return report.runCommandDispatchTopologyReport(null, { repositoryRoot: '.' });
		},
		name: 'command dispatch topology'
	},
	{
		async exerciseAdmission() {
			const report = await import('./run-command-handler-graph-report.js');
			return report.admitCommandHandlerGraphReportRequest({});
		},
		async exerciseProgress() {
			const report = await import('./run-command-handler-graph-report.js');
			return report.runCommandHandlerGraphReport(null, { repositoryRoot: '.' });
		},
		name: 'command-handler graph'
	},
	{
		async exerciseAdmission() {
			const report = await import('./run-arrow-command-census-report.js');
			return report.admitArrowCommandCensusReportRequest({});
		},
		async exerciseProgress() {
			const report = await import('./run-arrow-command-census-report.js');
			return report.runArrowCommandCensusReport(null, { repositoryRoot: '.' });
		},
		name: 'arrow-command census'
	},
	{
		async exerciseAdmission() {
			const report = await import('./run-read-write-access-report.js');
			return report.runReadWriteAccessReport({}, { repositoryRoot: '.' });
		},
		name: 'read/write access'
	},
	{
		async exerciseAdmission() {
			const report = await import('./run-declaration-context-report.js');
			return report.runDeclarationContextReport({}, { repositoryRoot: '.' });
		},
		name: 'declaration context'
	}
];

function installThrowingProxyDetector(): void {
	vi.doMock('../semantic/canonical.js', async (importOriginal) => {
		const actual = await importOriginal<typeof import('../semantic/canonical.js')>();
		return {
			...actual,
			isProxyValue() {
				throw new Error('synthetic hostile-value inspection failure');
			}
		};
	});
}

afterEach(() => {
	vi.doUnmock('../semantic/canonical.js');
	vi.resetModules();
});

describe('report hostile boundary containment', () => {
	it.each(reportCases)('$name contains an unexpected request-inspection failure', async (entry) => {
		installThrowingProxyDetector();
		const admissionOutcome = await entry.exerciseAdmission();
		expect(admissionOutcome).toMatchObject({
			code: 'REQUEST_INVALID',
			outcome: expect.stringMatching(/^(rejected|unavailable)$/u)
		});

		if (entry.exerciseProgress !== undefined) {
			const progressOutcome = await entry.exerciseProgress();
			expect(progressOutcome).toMatchObject({ outcome: 'unavailable', stage: 'REQUEST' });
		}
	});
});
