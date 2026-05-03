import { invokeSynthesisCoverageAudit } from '../../../../../../lib/review/harness/validators/llm/synthesisCoverageAudit';
import { runFactoryContractSuite } from './_factoryTestUtils';

runFactoryContractSuite('synthesis_coverage_audit', invokeSynthesisCoverageAudit, {
  runtime: {
    agentRole: 'domain_interpreter',
    subPhaseId: 'product_description_synthesis',
  },
});
