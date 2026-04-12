/**
 * InvariantChecker — deterministic, non-LLM validation.
 * Based on JanumiCode Spec v2.3, §8.10.
 *
 * Runs BEFORE Reasoning Review for every artifact. No LLM call required.
 * Fast and cheap — invariant failures cause immediate retry with the
 * violation injected into stdin, bypassing Reasoning Review entirely.
 *
 * Discovers .janumicode/schemas/invariants/*.invariants.json at startup.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { getLogger } from '../logging';

// ── Types ───────────────────────────────────────────────────────────

export interface InvariantRule {
  invariant_id: string;
  artifact_type: string;
  description: string;
  check_type: InvariantCheckType;
  specification: InvariantSpecification;
  severity: 'blocking' | 'warning';
  phase_applies_to: string[];
  introduced_in_sha?: string;
}

export type InvariantCheckType =
  | 'field_presence'
  | 'field_pattern'
  | 'cross_field'
  | 'count_minimum'
  | 'forbidden_pattern';

export interface InvariantSpecification {
  /** JSONPath-like field path (supports [*] for array iteration) */
  field_path?: string;
  /** Regex pattern to match (field_pattern) or forbid (forbidden_pattern) */
  pattern?: string;
  /** If true, the pattern is forbidden (forbidden_pattern check) */
  forbidden?: boolean;
  /** Human-readable violation message */
  message?: string;
  /** Minimum count required (count_minimum) */
  minimum?: number;
  /** Source field path for cross_field checks */
  source_field?: string;
  /** Target field path for cross_field checks */
  target_field?: string;
  /** Cross-field relationship type */
  relationship?: 'each_source_has_target' | 'each_target_has_source';
}

export interface InvariantCheckResult {
  artifact_type: string;
  checks_run: number;
  checks_passed: number;
  violations: InvariantViolation[];
  overall_pass: boolean;
}

export interface InvariantViolation {
  invariant_id: string;
  severity: 'blocking' | 'warning';
  message: string;
  location: string;
}

// ── InvariantChecker ────────────────────────────────────────────────

export class InvariantChecker {
  private rules = new Map<string, InvariantRule[]>();

  constructor(invariantsPath?: string) {
    if (invariantsPath) {
      this.loadRules(invariantsPath);
    }
  }

  /**
   * Discover and load all invariant files from the directory.
   */
  private loadRules(dirPath: string): void {
    if (!existsSync(dirPath)) return;

    const files = readdirSync(dirPath)
      .filter(f => f.endsWith('.invariants.json'));

    for (const file of files) {
      try {
        const content = readFileSync(join(dirPath, file), 'utf-8');
        const rules = JSON.parse(content) as InvariantRule[];
        const artifactType = basename(file, '.invariants.json');

        const existing = this.rules.get(artifactType) ?? [];
        existing.push(...rules);
        this.rules.set(artifactType, existing);
      } catch (err) {
        getLogger().warn('invariant', `Failed to load invariant file`, {
          file,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Add rules programmatically (for testing).
   */
  addRules(artifactType: string, rules: InvariantRule[]): void {
    const existing = this.rules.get(artifactType) ?? [];
    existing.push(...rules);
    this.rules.set(artifactType, existing);
  }

  /**
   * Run all invariant checks for an artifact type.
   */
  check(
    artifactType: string,
    content: Record<string, unknown>,
    phaseId?: string,
  ): InvariantCheckResult {
    const rules = this.rules.get(artifactType) ?? [];

    // Filter by phase if specified
    const applicableRules = phaseId
      ? rules.filter(r =>
          r.phase_applies_to.length === 0 || r.phase_applies_to.includes(phaseId)
        )
      : rules;

    const violations: InvariantViolation[] = [];

    for (const rule of applicableRules) {
      const ruleViolations = this.checkRule(rule, content);
      violations.push(...ruleViolations);
    }

    const hasBlockingViolation = violations.some(v => v.severity === 'blocking');

    return {
      artifact_type: artifactType,
      checks_run: applicableRules.length,
      checks_passed: applicableRules.length - violations.length,
      violations,
      overall_pass: !hasBlockingViolation,
    };
  }

  /**
   * Check a single invariant rule against content.
   */
  private checkRule(rule: InvariantRule, content: Record<string, unknown>): InvariantViolation[] {
    switch (rule.check_type) {
      case 'field_presence':
        return this.checkFieldPresence(rule, content);
      case 'field_pattern':
        return this.checkFieldPattern(rule, content);
      case 'forbidden_pattern':
        return this.checkForbiddenPattern(rule, content);
      case 'count_minimum':
        return this.checkCountMinimum(rule, content);
      case 'cross_field':
        return this.checkCrossField(rule, content);
      default:
        return [];
    }
  }

  // ── Check Type Implementations ──────────────────────────────────

  private checkFieldPresence(
    rule: InvariantRule,
    content: Record<string, unknown>,
  ): InvariantViolation[] {
    const spec = rule.specification;
    if (!spec.field_path) return [];

    const values = this.resolveFieldPath(content, spec.field_path);

    if (values.length === 0) {
      return [{
        invariant_id: rule.invariant_id,
        severity: rule.severity,
        message: spec.message ?? `Required field missing: ${spec.field_path}`,
        location: spec.field_path,
      }];
    }

    // Check that resolved values are non-null/non-undefined
    const violations: InvariantViolation[] = [];
    for (const { path, value } of values) {
      if (value === null || value === undefined || value === '') {
        violations.push({
          invariant_id: rule.invariant_id,
          severity: rule.severity,
          message: spec.message ?? `Field is empty: ${path}`,
          location: path,
        });
      }
    }

    return violations;
  }

  private checkFieldPattern(
    rule: InvariantRule,
    content: Record<string, unknown>,
  ): InvariantViolation[] {
    const spec = rule.specification;
    if (!spec.field_path || !spec.pattern) return [];

    const values = this.resolveFieldPath(content, spec.field_path);
    const regex = new RegExp(spec.pattern);
    const violations: InvariantViolation[] = [];

    for (const { path, value } of values) {
      if (typeof value === 'string' && !regex.test(value)) {
        violations.push({
          invariant_id: rule.invariant_id,
          severity: rule.severity,
          message: spec.message ?? `Field does not match pattern ${spec.pattern}: ${path}`,
          location: path,
        });
      }
    }

    return violations;
  }

  private checkForbiddenPattern(
    rule: InvariantRule,
    content: Record<string, unknown>,
  ): InvariantViolation[] {
    const spec = rule.specification;
    if (!spec.field_path || !spec.pattern) return [];

    const values = this.resolveFieldPath(content, spec.field_path);
    const regex = new RegExp(spec.pattern, 'i');
    const violations: InvariantViolation[] = [];

    for (const { path, value } of values) {
      if (typeof value === 'string' && regex.test(value)) {
        violations.push({
          invariant_id: rule.invariant_id,
          severity: rule.severity,
          message: spec.message ?? `Field contains forbidden pattern: ${path}`,
          location: path,
        });
      }
    }

    return violations;
  }

  private checkCountMinimum(
    rule: InvariantRule,
    content: Record<string, unknown>,
  ): InvariantViolation[] {
    const spec = rule.specification;
    if (!spec.field_path) return [];

    const minimum = spec.minimum ?? 1;
    const values = this.resolveFieldPath(content, spec.field_path);

    // If field_path ends with [*], count the array items
    // Otherwise count resolved values
    if (spec.field_path.endsWith('[*]')) {
      // Get the parent array
      const parentPath = spec.field_path.replace(/\[\*\]$/, '');
      const parents = this.resolveFieldPath(content, parentPath);

      for (const { path, value } of parents) {
        if (Array.isArray(value) && value.length < minimum) {
          return [{
            invariant_id: rule.invariant_id,
            severity: rule.severity,
            message: spec.message ?? `Array at ${path} has ${value.length} items, minimum is ${minimum}`,
            location: path,
          }];
        }
      }
    } else if (values.length < minimum) {
      return [{
        invariant_id: rule.invariant_id,
        severity: rule.severity,
        message: spec.message ?? `Expected at least ${minimum} values at ${spec.field_path}, found ${values.length}`,
        location: spec.field_path,
      }];
    }

    return [];
  }

  private checkCrossField(
    rule: InvariantRule,
    content: Record<string, unknown>,
  ): InvariantViolation[] {
    const spec = rule.specification;
    if (!spec.source_field || !spec.target_field) return [];

    const sourceValues = this.resolveFieldPath(content, spec.source_field);
    const targetValues = this.resolveFieldPath(content, spec.target_field);

    const sourceIds = new Set(sourceValues.map(v => String(v.value)));
    const targetIds = new Set(targetValues.map(v => String(v.value)));

    const violations: InvariantViolation[] = [];

    if (spec.relationship === 'each_source_has_target') {
      for (const sourceId of sourceIds) {
        if (!targetIds.has(sourceId)) {
          violations.push({
            invariant_id: rule.invariant_id,
            severity: rule.severity,
            message: spec.message ?? `Source value ${sourceId} has no matching target in ${spec.target_field}`,
            location: `${spec.source_field} → ${spec.target_field}`,
          });
        }
      }
    } else if (spec.relationship === 'each_target_has_source') {
      for (const targetId of targetIds) {
        if (!sourceIds.has(targetId)) {
          violations.push({
            invariant_id: rule.invariant_id,
            severity: rule.severity,
            message: spec.message ?? `Target value ${targetId} has no matching source in ${spec.source_field}`,
            location: `${spec.target_field} → ${spec.source_field}`,
          });
        }
      }
    }

    return violations;
  }

  // ── Field Path Resolution ───────────────────────────────────────

  /**
   * Resolve a JSONPath-like field path to values.
   * Supports:
   *   - Simple paths: "field.subfield"
   *   - Array wildcards: "items[*].name"
   *   - Nested wildcards: "items[*].sub[*].value"
   */
  resolveFieldPath(
    obj: unknown,
    fieldPath: string,
  ): { path: string; value: unknown }[] {
    const segments = this.parseFieldPath(fieldPath);
    return this.resolveSegments(obj, segments, '');
  }

  private parseFieldPath(path: string): string[] {
    // Split on '.' but keep [*] as part of the preceding segment
    const result: string[] = [];
    const parts = path.split('.');

    for (const part of parts) {
      if (part.endsWith('[*]')) {
        result.push(part.slice(0, -3)); // field name
        result.push('[*]');             // array wildcard
      } else {
        result.push(part);
      }
    }

    return result;
  }

  private resolveSegments(
    obj: unknown,
    segments: string[],
    currentPath: string,
  ): { path: string; value: unknown }[] {
    if (segments.length === 0) {
      return [{ path: currentPath || '/', value: obj }];
    }

    const [head, ...tail] = segments;

    if (head === '[*]') {
      // Iterate array items
      if (!Array.isArray(obj)) return [];
      const results: { path: string; value: unknown }[] = [];
      for (let i = 0; i < obj.length; i++) {
        results.push(...this.resolveSegments(obj[i], tail, `${currentPath}[${i}]`));
      }
      return results;
    }

    // Navigate into object field
    if (obj === null || obj === undefined || typeof obj !== 'object') return [];
    const value = (obj as Record<string, unknown>)[head];
    if (value === undefined) return [];

    const newPath = currentPath ? `${currentPath}.${head}` : head;
    return this.resolveSegments(value, tail, newPath);
  }
}
