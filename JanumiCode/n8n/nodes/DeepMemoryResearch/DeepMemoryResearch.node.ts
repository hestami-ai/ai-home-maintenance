import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

interface DMRPacket {
  activeConstraints: any[];
  contextItems: any[];
  query: string;
  scope: string;
  requestingAgentRole: string;
}

export class DeepMemoryResearch implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Deep Memory Research',
    name: 'deepMemoryResearch',
    icon: 'fa:search',
    group: ['transform'],
    version: 1,
    description: 'RAG-based context retrieval from Governed Stream',
    defaults: {
      name: 'Deep Memory Research',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [],
    properties: [
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        default: '',
        description: 'The search query for context retrieval',
      },
      {
        displayName: 'Scope',
        name: 'scope',
        type: 'string',
        default: '',
        description: 'The scope of the search (e.g., all, current_phase, prior_runs)',
      },
      {
        displayName: 'Requesting Agent Role',
        name: 'requestingAgentRole',
        type: 'string',
        default: '',
        description: 'The agent role requesting context (e.g., executor, verifier)',
      },
      {
        displayName: 'Authority Level Minimum',
        name: 'authorityLevelMin',
        type: 'number',
        default: 1,
        description: 'Minimum authority level to include in results',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const query = this.getNodeParameter('query', i) as string;
      const scope = this.getNodeParameter('scope', i) as string;
      const requestingAgentRole = this.getNodeParameter('requestingAgentRole', i) as string;
      const authorityLevelMin = this.getNodeParameter('authorityLevelMin', i) as number;

      // Read from Governed Stream (workflow static data for PoC)
      const staticData = this.getWorkflowStaticData('global');
      const governedStream = Array.isArray(staticData.governedStream) ? staticData.governedStream : [];

      // Filter records based on scope and authority level
      let filteredRecords = governedStream.filter((r: any) => r.authorityLevel >= authorityLevelMin);

      // Apply scope filter
      if (scope === 'current_phase') {
        // Filter by current phase (would need phase ID as input)
        // For PoC, we'll just return all records
      } else if (scope === 'prior_runs') {
        // Filter by prior runs (would need run ID as input)
        // For PoC, we'll just return all records
      }

      // Apply EXECUTOR_IRRELEVANT_RECORD_TYPES filter
      const executorIrrelevantTypes = ['constitutional_invariant', 'system_prompt'];
      if (requestingAgentRole === 'executor') {
        filteredRecords = filteredRecords.filter((r: any) => 
          !executorIrrelevantTypes.includes(r.recordType)
        );
      }

      // Simple keyword search for PoC (in production, this would be RAG with vector embeddings)
      const contextItems = query
        ? filteredRecords.filter((r: any) => 
            JSON.stringify(r.content).toLowerCase().includes(query.toLowerCase()) ||
            r.recordType.toLowerCase().includes(query.toLowerCase())
          )
        : filteredRecords;

      // Extract active constraints (Authority Level 6+)
      const activeConstraints = filteredRecords.filter((r: any) => r.authorityLevel >= 6);

      const result: DMRPacket = {
        activeConstraints,
        contextItems,
        query,
        scope,
        requestingAgentRole,
      };

      returnData.push({
        json: {
          success: true,
          query,
          scope,
          requestingAgentRole,
          result,
        },
      });
    }

    return [returnData];
  }
}
