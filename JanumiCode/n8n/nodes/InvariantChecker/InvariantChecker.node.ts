import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import * as fs from 'fs';
import * as path from 'path';

interface InvariantRule {
  invariant_id: string;
  artifact_type: string;
  description: string;
  check_type: 'field_presence' | 'field_pattern' | 'forbidden_pattern' | 'count_minimum' | 'cross_field';
  specification: any;
  severity: 'blocking' | 'advisory';
  phase_applies_to: string[];
}

interface InvariantViolation {
  invariant_id: string;
  description: string;
  severity: 'blocking' | 'advisory';
  field_path?: string;
  message: string;
}

interface InvariantCheckResult {
  passed: boolean;
  violations: InvariantViolation[];
  total_rules_checked: number;
}

export class InvariantChecker implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Invariant Checker',
    name: 'invariantChecker',
    icon: 'fa:shield',
    group: ['transform'],
    version: 1,
    description: 'Check artifacts against invariant rules',
    defaults: {
      name: 'Invariant Checker',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [],
    properties: [
      {
        displayName: 'Artifact Type',
        name: 'artifactType',
        type: 'string',
        default: '',
        description: 'The type of artifact to check (e.g., component_model, architectural_decisions)',
      },
      {
        displayName: 'Artifact Content',
        name: 'artifactContent',
        type: 'json',
        default: {},
        description: 'The artifact content to check',
      },
      {
        displayName: 'Phase ID',
        name: 'phaseId',
        type: 'string',
        default: '',
        description: 'The current phase ID (e.g., 4)',
      },
    ],
  };

  private static loadInvariantRules(artifactType: string): InvariantRule[] {
    const rulesPath = path.join(__dirname, '../../schemas/invariants');
    const ruleFile = path.join(rulesPath, `${artifactType}.invariants.json`);
    
    if (!fs.existsSync(ruleFile)) {
      return [];
    }

    const content = fs.readFileSync(ruleFile, 'utf-8');
    return JSON.parse(content) as InvariantRule[];
  }

  private static getFieldByPath(obj: any, fieldPath: string): any {
    const parts = fieldPath.split('[*]');
    let current = obj;
    
    for (const part of parts) {
      if (part === '') continue;
      
      if (part.startsWith('[') && part.endsWith(']')) {
        const index = parseInt(part.slice(1, -1));
        if (Array.isArray(current) && current[index] !== undefined) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        if (current && current[part] !== undefined) {
          current = current[part];
        } else {
          return undefined;
        }
      }
    }
    
    return current;
  }

  private static checkFieldPresence(obj: any, spec: any): InvariantViolation | null {
    const fieldValue = InvariantChecker.getFieldByPath(obj, spec.field_path);
    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
      return {
        invariant_id: 'field_presence',
        description: spec.message || 'Required field is missing',
        severity: 'blocking',
        field_path: spec.field_path,
        message: spec.message || `Field ${spec.field_path} is required but missing`,
      };
    }
    return null;
  }

  private static checkFieldPattern(obj: any, spec: any): InvariantViolation | null {
    const fieldValue = InvariantChecker.getFieldByPath(obj, spec.field_path);
    if (fieldValue === undefined || fieldValue === null) {
      return null; // Field presence should be checked separately
    }

    const regex = new RegExp(spec.pattern);
    if (!regex.test(String(fieldValue))) {
      return {
        invariant_id: 'field_pattern',
        description: spec.message || 'Field does not match required pattern',
        severity: 'blocking',
        field_path: spec.field_path,
        message: spec.message || `Field ${spec.field_path} does not match pattern ${spec.pattern}`,
      };
    }
    return null;
  }

  private static checkForbiddenPattern(obj: any, spec: any): InvariantViolation | null {
    const fieldValue = InvariantChecker.getFieldByPath(obj, spec.field_path);
    if (fieldValue === undefined || fieldValue === null) {
      return null;
    }

    const regex = new RegExp(spec.pattern);
    if (regex.test(String(fieldValue))) {
      return {
        invariant_id: 'forbidden_pattern',
        description: spec.message || 'Field contains forbidden pattern',
        severity: 'blocking',
        field_path: spec.field_path,
        message: spec.message || `Field ${spec.field_path} contains forbidden pattern ${spec.pattern}`,
      };
    }
    return null;
  }

  private static checkCountMinimum(obj: any, spec: any): InvariantViolation | null {
    const fieldValue = InvariantChecker.getFieldByPath(obj, spec.field_path);
    if (fieldValue === undefined || fieldValue === null) {
      return {
        invariant_id: 'count_minimum',
        description: spec.message || 'Required field is missing',
        severity: 'blocking',
        field_path: spec.field_path,
        message: spec.message || `Field ${spec.field_path} is required but missing`,
      };
    }

    const count = Array.isArray(fieldValue) ? fieldValue.length : 1;
    if (count < spec.minimum) {
      return {
        invariant_id: 'count_minimum',
        description: spec.message || 'Count below minimum',
        severity: 'blocking',
        field_path: spec.field_path,
        message: spec.message || `Field ${spec.field_path} has count ${count} but minimum is ${spec.minimum}`,
      };
    }
    return null;
  }

  private static checkCrossField(obj: any, spec: any): InvariantViolation | null {
    // Simplified cross-field check for PoC
    // In production, this would implement more complex field relationship validation
    const field1Value = InvariantChecker.getFieldByPath(obj, spec.field_path_1);
    const field2Value = InvariantChecker.getFieldByPath(obj, spec.field_path_2);

    if (spec.relationship === 'equals' && field1Value !== field2Value) {
      return {
        invariant_id: 'cross_field',
        description: spec.message || 'Fields must be equal',
        severity: 'blocking',
        field_path: `${spec.field_path_1}, ${spec.field_path_2}`,
        message: spec.message || `Fields ${spec.field_path_1} and ${spec.field_path_2} must be equal`,
      };
    }

    return null;
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const artifactType = this.getNodeParameter('artifactType', i) as string;
      const artifactContent = this.getNodeParameter('artifactContent', i) as object;
      const phaseId = this.getNodeParameter('phaseId', i) as string;

      const rules = InvariantChecker.loadInvariantRules(artifactType);
      const violations: InvariantViolation[] = [];

      for (const rule of rules) {
        // Check if rule applies to current phase
        if (rule.phase_applies_to.length > 0 && !rule.phase_applies_to.includes(phaseId)) {
          continue;
        }

        let violation: InvariantViolation | null = null;

        switch (rule.check_type) {
          case 'field_presence':
            violation = InvariantChecker.checkFieldPresence(artifactContent, rule.specification);
            break;
          case 'field_pattern':
            violation = InvariantChecker.checkFieldPattern(artifactContent, rule.specification);
            break;
          case 'forbidden_pattern':
            violation = InvariantChecker.checkForbiddenPattern(artifactContent, rule.specification);
            break;
          case 'count_minimum':
            violation = InvariantChecker.checkCountMinimum(artifactContent, rule.specification);
            break;
          case 'cross_field':
            violation = InvariantChecker.checkCrossField(artifactContent, rule.specification);
            break;
        }

        if (violation) {
          violations.push({
            ...violation,
            invariant_id: rule.invariant_id,
            description: rule.description,
            severity: rule.severity,
          });
        }
      }

      const result: InvariantCheckResult = {
        passed: violations.filter(v => v.severity === 'blocking').length === 0,
        violations,
        total_rules_checked: rules.length,
      };

      returnData.push({
        json: {
          success: true,
          artifactType,
          phaseId,
          result,
        },
      });
    }

    return [returnData];
  }
}
