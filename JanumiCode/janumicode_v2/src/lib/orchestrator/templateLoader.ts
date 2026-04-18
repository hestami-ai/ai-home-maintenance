/**
 * TemplateLoader — loads prompt template .md files with YAML frontmatter.
 * Based on JanumiCode Spec v2.3, §9.
 *
 * Template structure:
 *   ---
 *   [JC:PROMPT TEMPLATE]
 *   agent_role: executor_agent
 *   sub_phase: 09_1_implementation_task_execution
 *   schema_version: 1.2
 *   co_invocation_exception: false
 *   required_variables:
 *     - active_constraints
 *     - implementation_task
 *   reasoning_review_triggers:
 *     - implementation_divergence_check
 *   verification_ensemble_triggers:
 *     - implementation_divergence_check
 *   ---
 *   [JC:SYSTEM SCOPE]
 *   You are the [JC:Executor Agent]...
 *   {{active_constraints}}
 *   ...
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';
import { getLogger } from '../logging';

// ── Types ───────────────────────────────────────────────────────────

export interface PromptTemplate {
  /** File path relative to prompts root */
  path: string;
  /** Parsed frontmatter metadata */
  metadata: TemplateMetadata;
  /** Template body (after frontmatter) with {{variable}} placeholders */
  body: string;
}

export interface TemplateMetadata {
  agent_role: string;
  sub_phase: string;
  /**
   * Optional intent-lens discriminator. When set, the template is chosen only
   * when the runtime lens matches; templates without this field are treated
   * as lens-neutral fallbacks.
   */
  lens?: string;
  schema_version: string;
  co_invocation_exception: boolean;
  co_invocation_rationale?: string;
  co_invocation_artifact_types?: string[];
  required_variables: string[];
  reasoning_review_triggers: string[];
  verification_ensemble_triggers: string[];
}

export interface TemplateRenderResult {
  rendered: string;
  missing_variables: string[];
}

// ── TemplateLoader ──────────────────────────────────────────────────

export class TemplateLoader {
  private templates = new Map<string, PromptTemplate>();
  private promptsRoot: string;

  constructor(workspacePath: string) {
    this.promptsRoot = join(workspacePath, '.janumicode', 'prompts');
    this.loadAll();
  }

  /**
   * Recursively discover and load all .system.md and .prompt.md files.
   */
  private loadAll(): void {
    if (!existsSync(this.promptsRoot)) return;
    this.loadDir(this.promptsRoot);
  }

  private loadDir(dirPath: string): void {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        this.loadDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        this.loadFile(fullPath);
      }
    }
  }

  private loadFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const template = this.parseTemplate(filePath, content);
      if (template) {
        const key = this.templateKey(filePath);
        this.templates.set(key, template);
      }
    } catch (err) {
      getLogger().warn('context', `Failed to load template file`, {
        file: filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Parse a template file into metadata + body.
   */
  private parseTemplate(filePath: string, content: string): PromptTemplate | null {
    // Find frontmatter delimiters
    const lines = content.split('\n');
    let frontmatterStart = -1;
    let frontmatterEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (frontmatterStart === -1) {
          frontmatterStart = i;
        } else {
          frontmatterEnd = i;
          break;
        }
      }
    }

    if (frontmatterStart === -1 || frontmatterEnd === -1) {
      // No frontmatter — treat entire file as body with default metadata
      return null;
    }

    const frontmatterLines = lines.slice(frontmatterStart + 1, frontmatterEnd);
    const body = lines.slice(frontmatterEnd + 1).join('\n').trim();

    const metadata = this.parseFrontmatter(frontmatterLines);

    return {
      path: relative(this.promptsRoot, filePath),
      metadata,
      body,
    };
  }

  /**
   * Parse YAML-like frontmatter (simple key: value format).
   * Supports single values and arrays (- item format).
   */
  private parseFrontmatter(lines: string[]): TemplateMetadata {
    const result: Record<string, unknown> = {};
    let currentKey: string | null = null;
    let currentArray: string[] | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip the [JC:PROMPT TEMPLATE] header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) continue;
      if (trimmed === '' || trimmed.startsWith('#')) continue;

      // Array item
      if (trimmed.startsWith('- ') && currentKey) {
        if (!currentArray) currentArray = [];
        currentArray.push(trimmed.slice(2).trim());
        continue;
      }

      // Save accumulated array
      if (currentKey && currentArray) {
        result[currentKey] = currentArray;
        currentArray = null;
      }

      // Key: value pair
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      currentKey = key;

      if (value === '') {
        // Next lines might be array items
        currentArray = [];
      } else if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      } else {
        result[key] = value;
      }
    }

    // Save final accumulated array
    if (currentKey && currentArray) {
      result[currentKey] = currentArray;
    }

    return {
      agent_role: (result.agent_role as string) ?? 'unknown',
      sub_phase: (result.sub_phase as string) ?? 'unknown',
      lens: result.lens as string | undefined,
      schema_version: (result.schema_version as string) ?? '1.0',
      co_invocation_exception: (result.co_invocation_exception as boolean) ?? false,
      co_invocation_rationale: result.co_invocation_rationale as string | undefined,
      co_invocation_artifact_types: result.co_invocation_artifact_types as string[] | undefined,
      required_variables: (result.required_variables as string[]) ?? [],
      reasoning_review_triggers: (result.reasoning_review_triggers as string[]) ?? [],
      verification_ensemble_triggers: (result.verification_ensemble_triggers as string[]) ?? [],
    };
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Get a template by its key (relative path without extension).
   */
  getTemplate(key: string): PromptTemplate | null {
    return this.templates.get(key) ?? null;
  }

  /**
   * Get a template by agent role, sub-phase, and optional lens.
   *
   * Lookup order when `lens` is provided:
   *   1. exact (agent_role, sub_phase, lens) match
   *   2. lens-neutral (agent_role, sub_phase, lens unset) fallback
   *
   * When `lens` is omitted, only lens-neutral templates match.
   */
  findTemplate(
    agentRole: string,
    subPhase: string,
    lens?: string,
  ): PromptTemplate | null {
    let lensNeutralFallback: PromptTemplate | null = null;

    for (const template of this.templates.values()) {
      if (template.metadata.agent_role !== agentRole) continue;
      if (template.metadata.sub_phase !== subPhase) continue;

      const tLens = template.metadata.lens;

      if (lens && tLens === lens) {
        return template;
      }
      if (!tLens && !lensNeutralFallback) {
        lensNeutralFallback = template;
      }
    }

    return lensNeutralFallback;
  }

  /**
   * Render a template by substituting {{variable}} placeholders.
   * Returns rendered text and list of any missing required variables.
   */
  render(
    template: PromptTemplate,
    variables: Record<string, string>,
  ): TemplateRenderResult {
    const missing: string[] = [];

    // Check required variables
    for (const reqVar of template.metadata.required_variables) {
      if (!(reqVar in variables)) {
        missing.push(reqVar);
      }
    }

    // Substitute placeholders
    let rendered = template.body;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        value,
      );
    }

    return { rendered, missing_variables: missing };
  }

  /**
   * Validate that all required variables are available.
   * Hard-stops (returns error) if any are missing.
   */
  validateVariables(
    template: PromptTemplate,
    availableVariables: Set<string>,
  ): { valid: boolean; missing: string[] } {
    const missing = template.metadata.required_variables.filter(
      v => !availableVariables.has(v),
    );
    return { valid: missing.length === 0, missing };
  }

  /**
   * Get all loaded template keys.
   */
  getLoadedTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Add a template programmatically (for testing).
   */
  addTemplate(key: string, template: PromptTemplate): void {
    this.templates.set(key, template);
  }

  private templateKey(filePath: string): string {
    return relative(this.promptsRoot, filePath)
      .replace(/\\/g, '/')
      .replace(/\.md$/, '');
  }
}
