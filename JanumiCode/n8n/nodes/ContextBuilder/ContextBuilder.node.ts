import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

interface ContextBuildResult {
  stdinText: string;
  detailFilePath: string;
  size: number;
}

export class ContextBuilder implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Context Builder',
    name: 'contextBuilder',
    icon: 'fa:file-code',
    group: ['transform'],
    version: 1,
    description: 'Assemble stdin (directives) and detail file (evidence) for agent invocation',
    defaults: {
      name: 'Context Builder',
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
        displayName: 'Sub-Phase ID',
        name: 'subPhaseId',
        type: 'string',
        default: '',
        description: 'The sub-phase ID (e.g., workspace_classification)',
      },
      {
        displayName: 'Agent Role',
        name: 'agentRole',
        type: 'string',
        default: '',
        description: 'The agent role (e.g., executor, verifier, technical_expert)',
      },
      {
        displayName: 'Artifact References',
        name: 'artifactRefs',
        type: 'string',
        default: '',
        description: 'Comma-separated list of artifact IDs to include in context',
      },
      {
        displayName: 'Governing Constraints',
        name: 'governingConstraints',
        type: 'json',
        default: {},
        description: 'Governing constraints to include in stdin',
      },
      {
        displayName: 'Required Output Specification',
        name: 'requiredOutput',
        type: 'json',
        default: {},
        description: 'Required output specification for the agent',
      },
      {
        displayName: 'Summary Context',
        name: 'summaryContext',
        type: 'string',
        default: '',
        description: 'Summary context to include in stdin',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const phaseId = this.getNodeParameter('phaseId', i) as string;
      const subPhaseId = this.getNodeParameter('subPhaseId', i) as string;
      const agentRole = this.getNodeParameter('agentRole', i) as string;
      const artifactRefs = this.getNodeParameter('artifactRefs', i) as string;
      const governingConstraints = this.getNodeParameter('governingConstraints', i) as object;
      const requiredOutput = this.getNodeParameter('requiredOutput', i) as object;
      const summaryContext = this.getNodeParameter('summaryContext', i) as string;

      // Build stdin (directive channel)
      const stdinParts: string[] = [];

      // Add governing constraints (Authority Level 6+)
      if (Object.keys(governingConstraints).length > 0) {
        stdinParts.push('## GOVERNING CONSTRAINTS (Authority Level 6+ - Full Text Required)');
        stdinParts.push(JSON.stringify(governingConstraints, null, 2));
        stdinParts.push('');
      }

      // Add required output specification
      if (Object.keys(requiredOutput).length > 0) {
        stdinParts.push('## REQUIRED OUTPUT SPECIFICATION');
        stdinParts.push(JSON.stringify(requiredOutput, null, 2));
        stdinParts.push('');
      }

      // Add summary context
      if (summaryContext) {
        stdinParts.push('## SUMMARY CONTEXT');
        stdinParts.push(summaryContext);
        stdinParts.push('');
      }

      // Add phase/sub-phase context
      stdinParts.push('## EXECUTION CONTEXT');
      stdinParts.push(`Phase: ${phaseId}`);
      stdinParts.push(`Sub-Phase: ${subPhaseId}`);
      stdinParts.push(`Agent Role: ${agentRole}`);
      stdinParts.push('');

      // Add artifact references
      if (artifactRefs) {
        stdinParts.push('## ARTIFACT REFERENCES');
        stdinParts.push(artifactRefs);
        stdinParts.push('');
      }

      const stdinText = stdinParts.join('\n');

      // Build detail file path (reference channel)
      const detailFilePath = `.janumicode/runs/${phaseId}_${subPhaseId}_${Date.now()}.md`;

      // For PoC, we'll return the detail file content as well
      // In production, this would be written to disk
      const detailFileContent = ContextBuilder.buildDetailFileContent(
        phaseId,
        subPhaseId,
        artifactRefs,
        governingConstraints,
        requiredOutput,
        summaryContext
      );

      const result: ContextBuildResult = {
        stdinText,
        detailFilePath,
        size: stdinText.length + detailFileContent.length,
      };

      returnData.push({
        json: {
          success: true,
          phaseId,
          subPhaseId,
          agentRole,
          result,
          detailFileContent,
        },
      });
    }

    return [returnData];
  }

  private static buildDetailFileContent(
    phaseId: string,
    subPhaseId: string,
    artifactRefs: string,
    governingConstraints: object,
    requiredOutput: object,
    summaryContext: string
  ): string {
    const parts: string[] = [];

    parts.push(`# Detail File for ${phaseId}.${subPhaseId}`);
    parts.push('');
    parts.push(`Generated: ${new Date().toISOString()}`);
    parts.push('');

    if (Object.keys(governingConstraints).length > 0) {
      parts.push('## Governing Constraints (Full Text)');
      parts.push(JSON.stringify(governingConstraints, null, 2));
      parts.push('');
    }

    if (Object.keys(requiredOutput).length > 0) {
      parts.push('## Required Output Specification');
      parts.push(JSON.stringify(requiredOutput, null, 2));
      parts.push('');
    }

    if (summaryContext) {
      parts.push('## Summary Context');
      parts.push(summaryContext);
      parts.push('');
    }

    if (artifactRefs) {
      parts.push('## Artifact References');
      parts.push(artifactRefs);
      parts.push('');
    }

    return parts.join('\n');
  }
}
