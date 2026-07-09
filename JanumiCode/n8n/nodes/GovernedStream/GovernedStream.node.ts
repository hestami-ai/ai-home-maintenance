import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class GovernedStream implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Governed Stream',
    name: 'governedStream',
    icon: 'fa:database',
    group: ['input'],
    version: 1,
    description: 'Read and write records to the Governed Stream database',
    defaults: {
      name: 'Governed Stream',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [],
    properties: [
      {
        displayName: 'Action',
        name: 'action',
        type: 'options',
        options: [
          { name: 'Write Record', value: 'write' },
          { name: 'Read Records', value: 'read' },
        ],
        default: 'write',
        description: 'Whether to write a new record or read existing records',
      },
      {
        displayName: 'Record Type',
        name: 'recordType',
        type: 'string',
        displayOptions: {
          show: {
            action: ['write'],
          },
        },
        default: '',
        description: 'The type of record to write (e.g., workspace_classification, intent_statement)',
      },
      {
        displayName: 'Content',
        name: 'content',
        type: 'json',
        displayOptions: {
          show: {
            action: ['write'],
          },
        },
        default: {},
        description: 'The content of the record as JSON',
      },
      {
        displayName: 'Authority Level',
        name: 'authorityLevel',
        type: 'number',
        displayOptions: {
          show: {
            action: ['write'],
          },
        },
        default: 5,
        description: 'Authority level (1-7), where 7 is constitutional',
      },
      {
        displayName: 'Phase ID',
        name: 'phaseId',
        type: 'string',
        displayOptions: {
          show: {
            action: ['write'],
          },
        },
        default: '',
        description: 'The phase ID (e.g., 0, 1, 2)',
      },
      {
        displayName: 'Sub-Phase ID',
        name: 'subPhaseId',
        type: 'string',
        displayOptions: {
          show: {
            action: ['write'],
          },
        },
        default: '',
        description: 'The sub-phase ID (e.g., workspace_classification)',
      },
      {
        displayName: 'Record Type Filter',
        name: 'recordTypeFilter',
        type: 'string',
        displayOptions: {
          show: {
            action: ['read'],
          },
        },
        default: '',
        description: 'Filter by record type (leave empty for all)',
      },
      {
        displayName: 'Phase ID Filter',
        name: 'phaseIdFilter',
        type: 'string',
        displayOptions: {
          show: {
            action: ['read'],
          },
        },
        default: '',
        description: 'Filter by phase ID (leave empty for all)',
      },
      {
        displayName: 'Authority Level Minimum',
        name: 'authorityLevelMin',
        type: 'number',
        displayOptions: {
          show: {
            action: ['read'],
          },
        },
        default: 1,
        description: 'Minimum authority level to include in results',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const action = this.getNodeParameter('action', 0) as string;
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      if (action === 'write') {
        const recordType = this.getNodeParameter('recordType', i) as string;
        const content = this.getNodeParameter('content', i) as object;
        const authorityLevel = this.getNodeParameter('authorityLevel', i) as number;
        const phaseId = this.getNodeParameter('phaseId', i) as string;
        const subPhaseId = this.getNodeParameter('subPhaseId', i) as string;

        // For PoC, we'll use n8n's workflow static data to simulate Governed Stream
        // In production, this would write to an external SQLite database
        const recordId = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const effectiveAt = new Date().toISOString();
        const janumicodeVersionSha = 'poc-sha-placeholder';

        const record = {
          recordId,
          recordType,
          content,
          authorityLevel,
          phaseId,
          subPhaseId,
          effectiveAt,
          janumicodeVersionSha,
        };

        // Store in workflow static data for simulation
        const staticData = this.getWorkflowStaticData('global');
        if (!Array.isArray(staticData.governedStream)) {
          staticData.governedStream = [];
        }
        (staticData.governedStream as any[]).push(record);

        returnData.push({
          json: {
            success: true,
            recordId,
            message: `Record written to Governed Stream: ${recordType}`,
            record,
          },
        });
      } else if (action === 'read') {
        const recordTypeFilter = this.getNodeParameter('recordTypeFilter', i) as string;
        const phaseIdFilter = this.getNodeParameter('phaseIdFilter', i) as string;
        const authorityLevelMin = this.getNodeParameter('authorityLevelMin', i) as number;

        // Read from workflow static data
        const staticData = this.getWorkflowStaticData('global');
        const records = Array.isArray(staticData.governedStream) ? staticData.governedStream : [];

        let filteredRecords = records;

        if (recordTypeFilter) {
          filteredRecords = filteredRecords.filter((r: any) => r.recordType === recordTypeFilter);
        }

        if (phaseIdFilter) {
          filteredRecords = filteredRecords.filter((r: any) => r.phaseId === phaseIdFilter);
        }

        filteredRecords = filteredRecords.filter((r: any) => r.authorityLevel >= authorityLevelMin);

        returnData.push({
          json: {
            success: true,
            count: filteredRecords.length,
            records: filteredRecords,
          },
        });
      }
    }

    return [returnData];
  }
}
