/**
 * Brief bank / firm-knowledge artifacts persistence.
 */

import type Database from 'better-sqlite3';
import type { Scope } from './types.js';

export interface FirmKnowledgeArtifactRow {
  knowledgeId: string;
  firmId: string;
  title: string;
  artifactType: string;
  contentScrubbed: string;
  promotedFrom: Scope & { artifactId: string };
  promotedAt: string;
  promotedByAttorneyId: string;
  promotedByAttorneyActionId: string;
}

export class BriefBankDal {
  constructor(private readonly db: Database.Database) {}

  insert(row: FirmKnowledgeArtifactRow): void {
    this.db
      .prepare(
        `INSERT INTO firm_knowledge_artifacts
         (firm_id, knowledge_id, title, artifact_type, content_scrubbed,
          promoted_from_firm_id, promoted_from_client_id, promoted_from_matter_id, promoted_from_artifact_id,
          promoted_at, promoted_by_attorney_id, promoted_by_attorney_action_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.firmId,
        row.knowledgeId,
        row.title,
        row.artifactType,
        row.contentScrubbed,
        row.promotedFrom.firmId,
        row.promotedFrom.clientId,
        row.promotedFrom.matterId,
        row.promotedFrom.artifactId,
        row.promotedAt,
        row.promotedByAttorneyId,
        row.promotedByAttorneyActionId,
      );
  }

  countForFirm(firmId: string): number {
    const r = this.db.prepare('SELECT COUNT(*) AS n FROM firm_knowledge_artifacts WHERE firm_id = ?').get(firmId) as { n: number };
    return r.n;
  }

  get(firmId: string, knowledgeId: string): FirmKnowledgeArtifactRow | undefined {
    const r = this.db
      .prepare(
        `SELECT * FROM firm_knowledge_artifacts WHERE firm_id = ? AND knowledge_id = ?`,
      )
      .get(firmId, knowledgeId) as
      | {
          firm_id: string;
          knowledge_id: string;
          title: string;
          artifact_type: string;
          content_scrubbed: string;
          promoted_from_firm_id: string;
          promoted_from_client_id: string;
          promoted_from_matter_id: string;
          promoted_from_artifact_id: string;
          promoted_at: string;
          promoted_by_attorney_id: string;
          promoted_by_attorney_action_id: string;
        }
      | undefined;
    if (!r) return undefined;
    return {
      knowledgeId: r.knowledge_id,
      firmId: r.firm_id,
      title: r.title,
      artifactType: r.artifact_type,
      contentScrubbed: r.content_scrubbed,
      promotedFrom: {
        firmId: r.promoted_from_firm_id,
        clientId: r.promoted_from_client_id,
        matterId: r.promoted_from_matter_id,
        artifactId: r.promoted_from_artifact_id,
      },
      promotedAt: r.promoted_at,
      promotedByAttorneyId: r.promoted_by_attorney_id,
      promotedByAttorneyActionId: r.promoted_by_attorney_action_id,
    };
  }
}
