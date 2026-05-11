/**
 * Prompt-template registry.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 1 §1.3:
 *   "Prompt-template registry binds to CLV termIds; load fails if reference is unresolved."
 *
 * Templates declare which CLV terms they assert authority over via their
 * `clvBindings`. Body text may reference terms via `{{clv:<termId>:<field>}}`
 * placeholders; the registry validates that all referenced termIds exist in
 * the CLV before accepting the template.
 *
 * Wave 2 wires actual prompt assembly. Wave 1 ships registration + binding
 * validation.
 */

import type { CLV } from '../clv/types.js';
import type { PromptTemplateDal, PromptTemplateRow } from '../database/promptTemplateDal.js';

export interface PromptTemplateInput {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly lensId?: string;
  readonly stateId?: string;
  readonly body: string;
  /** Explicit CLV bindings declared by the template author. */
  readonly clvBindings: readonly string[];
}

export interface RegistrationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

const PLACEHOLDER_RE = /\{\{\s*clv:([a-z0-9._-]+)(?::[a-z_]+)?\s*\}\}/gi;

export class PromptTemplateRegistry {
  constructor(
    private readonly dal: PromptTemplateDal,
    private readonly clv: CLV,
  ) {}

  /**
   * Register a template. Validates that:
   *   - every declared CLV binding exists in the CLV.
   *   - every {{clv:<termId>}} placeholder in the body refers to an
   *     existing CLV term.
   *   - every placeholder's termId is present in clvBindings (templates must
   *     declare what they reference; no implicit dependencies).
   */
  register(input: PromptTemplateInput): RegistrationResult {
    const errors: string[] = [];

    for (const termId of input.clvBindings) {
      if (!this.clv.has(termId)) {
        errors.push(`declared binding ${termId} does not exist in CLV`);
      }
    }

    const bindingSet = new Set(input.clvBindings);
    const referencedTerms = new Set<string>();
    let m: RegExpExecArray | null;
    PLACEHOLDER_RE.lastIndex = 0;
    while ((m = PLACEHOLDER_RE.exec(input.body)) !== null) {
      const termId = m[1];
      referencedTerms.add(termId);
      if (!this.clv.has(termId)) {
        errors.push(`placeholder references unknown CLV term ${termId}`);
      }
      if (!bindingSet.has(termId)) {
        errors.push(`placeholder references ${termId} but it is not in clvBindings`);
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    const row: PromptTemplateRow = {
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      lensId: input.lensId ?? null,
      stateId: input.stateId ?? null,
      body: input.body,
      clvBindings: input.clvBindings,
      registeredAt: new Date().toISOString(),
    };
    this.dal.insert(row);
    return { ok: true, errors: [] };
  }

  get(templateId: string, templateVersion: string): PromptTemplateRow | undefined {
    return this.dal.get(templateId, templateVersion);
  }
}
