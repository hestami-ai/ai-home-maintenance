import { invokeMeasurementAdequacyValidator } from '../../../../../../lib/review/harness/validators/llm/measurementAdequacyValidator';
import { runFactoryContractSuite } from './_factoryTestUtils';

runFactoryContractSuite('measurement_adequacy_validator', invokeMeasurementAdequacyValidator, {
  runtime: { agentRole: 'requirements_agent', subPhaseId: 'fr_bloom_enrichment' },
});
