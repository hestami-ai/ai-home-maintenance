import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

interface PhaseGateResult {
  passed: boolean;
  phaseId: string;
  findings: any[];
  blockingIssues: any[];
  criteriaResults: {
    schemaValid: boolean;
    invariantsPassed: boolean;
    reasoningReviewPassed: boolean;
    consistencyPassed: boolean;
    domainAttested: boolean;
    verificationEnsemblePassed: boolean;
    humanApproved: boolean;
  };
}

export class PhaseGateEvaluator implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Phase Gate Evaluator',
    name: 'phaseGateEvaluator',
    icon: 'fa:check-circle',
    group: ['transform'],
    version: 1,
    description: 'Evaluate 7-criteria Phase Gate with short-circuit logic',
    defaults: {
      name: 'Phase Gate Evaluator',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [],
    properties: [
      {
        displayName: 'Phase ID',
        name: 'phaseId',
        type: 'string',
        default: '',
        description: 'The phase ID (e.g., 0, 1, 2)',
      },
      {
        displayName: 'Artifact IDs',
        name: 'artifactIds',
        type: 'string',
        default: '',
        description: 'Comma-separated list of artifact IDs to evaluate',
      },
      {
        displayName: 'Schema Valid',
        name: 'schemaValid',
        type: 'boolean',
        default: true,
        description: 'Whether schema validation passed',
      },
      {
        displayName: 'Invariants Passed',
        name: 'invariantsPassed',
        type: 'boolean',
        default: true,
        description: 'Whether invariant checks passed',
      },
      {
        displayName: 'Reasoning Review Passed',
        name: 'reasoningReviewPassed',
        type: 'boolean',
        default: true,
        description: 'Whether reasoning review passed',
      },
      {
        displayName: 'Consistency Passed',
        name: 'consistencyPassed',
        type: 'boolean',
        default: true,
        description: 'Whether consistency check passed',
      },
      {
        displayName: 'Domain Attested',
        name: 'domainAttested',
        type: 'boolean',
        default: true,
        description: 'Whether domain attestation passed',
      },
      {
        displayName: 'Verification Ensemble Passed',
        name: 'verificationEnsemblePassed',
        type: 'boolean',
        default: true,
        description: 'Whether verification ensemble passed',
      },
      {
        displayName: 'Human Approved',
        name: 'humanApproved',
        type: 'boolean',
        default: false,
        description: 'Whether human approved the phase gate',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const phaseId = this.getNodeParameter('phaseId', i) as string;
      const artifactIds = this.getNodeParameter('artifactIds', i) as string;
      const schemaValid = this.getNodeParameter('schemaValid', i) as boolean;
      const invariantsPassed = this.getNodeParameter('invariantsPassed', i) as boolean;
      const reasoningReviewPassed = this.getNodeParameter('reasoningReviewPassed', i) as boolean;
      const consistencyPassed = this.getNodeParameter('consistencyPassed', i) as boolean;
      const domainAttested = this.getNodeParameter('domainAttested', i) as boolean;
      const verificationEnsemblePassed = this.getNodeParameter('verificationEnsemblePassed', i) as boolean;
      const humanApproved = this.getNodeParameter('humanApproved', i) as boolean;

      const findings: any[] = [];
      const blockingIssues: any[] = [];

      // Step 1: Schema validation (blocking)
      if (!schemaValid) {
        blockingIssues.push({
          criterion: 'schema',
          severity: 'blocking',
          message: 'Schema validation failed',
        });
      } else {
        findings.push({ criterion: 'schema', status: 'passed' });
      }

      // Step 2: Invariant checks (blocking)
      if (!invariantsPassed) {
        blockingIssues.push({
          criterion: 'invariants',
          severity: 'blocking',
          message: 'Invariant checks failed',
        });
      } else {
        findings.push({ criterion: 'invariants', status: 'passed' });
      }

      // Step 3: Reasoning review (blocking)
      if (!reasoningReviewPassed) {
        blockingIssues.push({
          criterion: 'reasoning_review',
          severity: 'blocking',
          message: 'Reasoning review failed',
        });
      } else {
        findings.push({ criterion: 'reasoning_review', status: 'passed' });
      }

      // Step 4: Consistency check (blocking)
      if (!consistencyPassed) {
        blockingIssues.push({
          criterion: 'consistency',
          severity: 'blocking',
          message: 'Consistency check failed',
        });
      } else {
        findings.push({ criterion: 'consistency', status: 'passed' });
      }

      // Step 5: Domain attestation (blocking)
      if (!domainAttested) {
        blockingIssues.push({
          criterion: 'domain_attestation',
          severity: 'blocking',
          message: 'Domain attestation required',
        });
      } else {
        findings.push({ criterion: 'domain_attestation', status: 'passed' });
      }

      // Step 6: Verification ensemble (blocking)
      if (!verificationEnsemblePassed) {
        blockingIssues.push({
          criterion: 'verification_ensemble',
          severity: 'blocking',
          message: 'Verification ensemble failed',
        });
      } else {
        findings.push({ criterion: 'verification_ensemble', status: 'passed' });
      }

      // Step 7: Human approval (blocking - always required)
      if (!humanApproved) {
        blockingIssues.push({
          criterion: 'human_approval',
          severity: 'blocking',
          message: 'Human approval required',
        });
      } else {
        findings.push({ criterion: 'human_approval', status: 'passed' });
      }

      const result: PhaseGateResult = {
        passed: blockingIssues.length === 0,
        phaseId,
        findings,
        blockingIssues,
        criteriaResults: {
          schemaValid,
          invariantsPassed,
          reasoningReviewPassed,
          consistencyPassed,
          domainAttested,
          verificationEnsemblePassed,
          humanApproved,
        },
      };

      returnData.push({
        json: {
          success: true,
          phaseId,
          result,
        },
      });
    }

    return [returnData];
  }
}
