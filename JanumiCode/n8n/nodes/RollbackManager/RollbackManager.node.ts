import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

interface RollbackResult {
  success: boolean;
  rollbackToPhase: string;
  affectedArtifacts: string[];
  technicalDebtRecord: any;
  cascadeThresholdExceeded: boolean;
}

export class RollbackManager implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Rollback Manager',
    name: 'rollbackManager',
    icon: 'fa:undo',
    group: ['transform'],
    version: 1,
    description: 'Dependency closure rollback and artifact invalidation',
    defaults: {
      name: 'Rollback Manager',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [],
    properties: [
      {
        displayName: 'Workflow Run ID',
        name: 'workflowRunId',
        type: 'string',
        default: '',
        description: 'The workflow run ID to rollback',
      },
      {
        displayName: 'Rollback To Phase',
        name: 'rollbackToPhase',
        type: 'string',
        default: '',
        description: 'The phase to rollback to (e.g., 0, 1, 2)',
      },
      {
        displayName: 'Cascade Threshold Tasks',
        name: 'cascadeThresholdTasks',
        type: 'number',
        default: 100,
        description: 'Maximum number of refactoring tasks before cascade threshold is exceeded',
      },
      {
        displayName: 'Cascade Threshold Files',
        name: 'cascadeThresholdFiles',
        type: 'number',
        default: 50,
        description: 'Maximum number of files before cascade threshold is exceeded',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const workflowRunId = this.getNodeParameter('workflowRunId', i) as string;
      const rollbackToPhase = this.getNodeParameter('rollbackToPhase', i) as string;
      const cascadeThresholdTasks = this.getNodeParameter('cascadeThresholdTasks', i) as number;
      const cascadeThresholdFiles = this.getNodeParameter('cascadeThresholdFiles', i) as number;

      // Read from Governed Stream (workflow static data for PoC)
      const staticData = this.getWorkflowStaticData('global');
      const governedStream = Array.isArray(staticData.governedStream) ? staticData.governedStream : [];

      // Find artifacts from phases after rollbackToPhase
      const affectedArtifacts = governedStream
        .filter((r: any) => {
          const phaseNum = parseInt(r.phaseId);
          const rollbackNum = parseInt(rollbackToPhase);
          return !isNaN(phaseNum) && !isNaN(rollbackNum) && phaseNum > rollbackNum;
        })
        .map((r: any) => r.recordId);

      // Count estimated refactoring tasks and files (simplified for PoC)
      const estimatedRefactoringTasks = affectedArtifacts.length * 2; // Rough estimate
      const estimatedFileCount = affectedArtifacts.length; // Rough estimate

      // Check cascade thresholds
      const cascadeThresholdExceeded = 
        estimatedRefactoringTasks > cascadeThresholdTasks ||
        estimatedFileCount > cascadeThresholdFiles;

      // Create technical debt record
      const technicalDebtRecord = {
        technicalDebtId: `td_${Date.now()}`,
        workflowRunId,
        rollbackToPhase,
        affectedArtifacts,
        estimatedRefactoringTasks,
        estimatedFileCount,
        cascadeThresholdExceeded,
        createdAt: new Date().toISOString(),
        status: cascadeThresholdExceeded ? 'cascade_threshold_exceeded' : 'pending_review',
      };

      // In production, this would:
      // 1. Mark artifacts as invalidated in Governed Stream
      // 2. Record technical debt in database
      // 3. Trigger dependency closure analysis
      // For PoC, we'll just return the result

      const result: RollbackResult = {
        success: true,
        rollbackToPhase,
        affectedArtifacts,
        technicalDebtRecord,
        cascadeThresholdExceeded,
      };

      returnData.push({
        json: {
          success: true,
          workflowRunId,
          result,
        },
      });
    }

    return [returnData];
  }
}
