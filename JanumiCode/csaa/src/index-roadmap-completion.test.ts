import * as publicSurface from '@janumipwb/csaa';
import { describe, expect, it } from 'vitest';

describe('@janumipwb/csaa implementation-candidate public surface', () => {
	it('exports the coding-agent protocol, persistent workflow, and native analysis operations', () => {
		expect(publicSurface.AGENT_OPERATION_PROTOCOL_VERSION).toBe(
			'jan-csaa-agent-operation-protocol/0.1.0'
		);
		expect(publicSurface.CODING_AGENT_CLI_VERSION).toBe('jan-csaa-coding-agent-cli/0.1.0');
		expect(publicSurface.ContentAddressedFileStore).toBeTypeOf('function');
		expect(publicSurface.ContentAddressedCodingAgentCliArtifactStore).toBeTypeOf('function');
		expect(publicSurface.measureDwp007PersistenceSelection).toBeTypeOf('function');
		expect(publicSurface.validateDwp007PersistenceSelectionEvidence).toBeTypeOf('function');
		expect(publicSurface.measureContentAddressedStorePerformance).toBeTypeOf('function');
		expect(publicSurface.composeCodingAgentCliHandlers).toBeTypeOf('function');
		expect(publicSurface.runCodingAgentCli).toBeTypeOf('function');
		expect(publicSurface.runCodingAgentProcess).toBeTypeOf('function');
		expect(publicSurface.runCodingAgentProcessHost).toBeTypeOf('function');
		expect(publicSurface.runJpwbHarmonizationNativeProjection).toBeTypeOf('function');
		expect(publicSurface.runFourValuedQueryOperation).toBeTypeOf('function');
		expect(publicSurface.buildModuleCodeSlice).toBeTypeOf('function');
		expect(publicSurface.compareSemanticSnapshots).toBeTypeOf('function');
		expect(publicSurface.runHarmonizationBenchmarkAccounting).toBeTypeOf('function');
		expect(publicSurface.analyzeStructuralModuleGraph).toBeTypeOf('function');
		expect(publicSurface.buildStructuralWorkspaceDependencyGraph).toBeTypeOf('function');
		expect(publicSurface.assessDependencyCruiserDifferential).toBeTypeOf('function');
		expect(publicSurface.runCurrentDependencyCruiserDifferential).toBeTypeOf('function');
		expect(publicSurface.runCurrentDependencyCruiserG4Closure).toBeTypeOf('function');
		expect(publicSurface.CURRENT_DEPENDENCY_CRUISER_HISTORICAL_DIFFERENTIAL_DIGEST).toBe(
			'702f5a25ee3316c43a4066d3d0cd95bb860950a1a24663b4b43b4c3962a5e355'
		);
		expect(publicSurface.CURRENT_DEPENDENCY_CRUISER_REVIEWED_DIFFERENTIAL_DIGEST).toBe(
			'f83f2f4ef78e45b1f1bf3dadea85d9ff6a6d4d023a96d12e3b3c8abc7b4ca2aa'
		);
		expect(publicSurface.runStructuralModuleGraphReport).toBeTypeOf('function');
	});

	it('exports enriched provider imports, security analysis, and the measured provider disposition', () => {
		expect(publicSurface.importEslintJson).toBeTypeOf('function');
		expect(publicSurface.importVitestJson).toBeTypeOf('function');
		expect(publicSurface.importVitestV8Coverage).toBeTypeOf('function');
		expect(publicSurface.importDeterministicRuntimeTrace).toBeTypeOf('function');
		expect(publicSurface.evaluateHybridRuntimeRows).toBeTypeOf('function');
		expect(publicSurface.projectJpwbHybridStaticPrerequisites).toBeTypeOf('function');
		expect(publicSurface.evaluateProjectedHybridRuntimeRows).toBeTypeOf('function');
		expect(publicSurface.observeJpwbNativeSecurity).toBeTypeOf('function');
		expect(publicSurface.transformSvelteVirtualSource).toBeTypeOf('function');
		expect(publicSurface.assessAdvancedCpgProviderEntry).toBeTypeOf('function');
	});
});
