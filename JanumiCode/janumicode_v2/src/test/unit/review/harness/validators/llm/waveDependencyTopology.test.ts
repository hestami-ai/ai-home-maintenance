import { invokeWaveDependencyTopology } from '../../../../../../lib/review/harness/validators/llm/waveDependencyTopology';
import { runFactoryContractSuite } from './_factoryTestUtils';

runFactoryContractSuite('wave_dependency_topology', invokeWaveDependencyTopology, {
  runtime: { agentRole: 'orchestrator', subPhaseId: 'release_plan' },
});
