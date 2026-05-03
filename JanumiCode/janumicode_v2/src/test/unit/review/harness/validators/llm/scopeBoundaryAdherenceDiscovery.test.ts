import { invokeScopeBoundaryAdherenceDiscovery } from '../../../../../../lib/review/harness/validators/llm/scopeBoundaryAdherenceDiscovery';
import { runFactoryContractSuite } from './_factoryTestUtils';

runFactoryContractSuite(
  'scope_boundary_adherence_discovery',
  invokeScopeBoundaryAdherenceDiscovery,
  { runtime: { agentRole: 'domain_interpreter', subPhaseId: 'product_intent_discovery' } },
);
