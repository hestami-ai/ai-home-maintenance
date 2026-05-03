import { invokeSourceAttributionGrounding } from '../../../../../../lib/review/harness/validators/llm/sourceAttributionGrounding';
import { runFactoryContractSuite } from './_factoryTestUtils';

runFactoryContractSuite('source_attribution_grounding', invokeSourceAttributionGrounding, {
  runtime: { agentRole: 'domain_interpreter', subPhaseId: 'business_domains_bloom' },
});
