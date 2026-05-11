/**
 * Prompt template DAL surface.
 */

import type Database from 'better-sqlite3';

export interface PromptTemplateRow {
  templateId: string;
  templateVersion: string;
  lensId: string | null;
  stateId: string | null;
  body: string;
  clvBindings: readonly string[];
  registeredAt: string;
}

export class PromptTemplateDal {
  constructor(private readonly db: Database.Database) {}

  insert(row: PromptTemplateRow): void {
    this.db
      .prepare(
        `INSERT INTO prompt_templates (template_id, template_version, lens_id, state_id, body, clv_bindings_json, registered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.templateId,
        row.templateVersion,
        row.lensId,
        row.stateId,
        row.body,
        JSON.stringify(row.clvBindings),
        row.registeredAt,
      );
  }

  get(templateId: string, templateVersion: string): PromptTemplateRow | undefined {
    const r = this.db
      .prepare('SELECT * FROM prompt_templates WHERE template_id = ? AND template_version = ?')
      .get(templateId, templateVersion) as
      | {
          template_id: string;
          template_version: string;
          lens_id: string | null;
          state_id: string | null;
          body: string;
          clv_bindings_json: string;
          registered_at: string;
        }
      | undefined;
    if (!r) return undefined;
    return {
      templateId: r.template_id,
      templateVersion: r.template_version,
      lensId: r.lens_id,
      stateId: r.state_id,
      body: r.body,
      clvBindings: JSON.parse(r.clv_bindings_json) as string[],
      registeredAt: r.registered_at,
    };
  }
}
