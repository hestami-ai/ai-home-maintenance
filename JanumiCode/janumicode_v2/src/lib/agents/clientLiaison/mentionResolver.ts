/**
 * MentionResolver — resolves @mention queries to candidate references.
 *
 * Six mention types per spec §7.2:
 *   file       — workspace file (delegated to extension host via injected adapter)
 *   symbol     — LSP workspace symbol (delegated to extension host)
 *   decision   — DB decision_trace records (FTS-backed)
 *   constraint — DB constraint records (FTS-backed)
 *   phase      — phase artifacts by phase id
 *   run        — workflow_runs entries by date or short id
 *
 * The file/symbol resolvers live in the extension host where `vscode.workspace.findFiles`
 * and `executeWorkspaceSymbolProvider` are callable. We accept an injected ExtensionHost
 * adapter so the back-end agent stays decoupled from VS Code.
 */

import type { ClientLiaisonDB } from './db';
import type { MentionCandidate, MentionType } from './types';

export interface MentionExtensionHost {
  findFiles(query: string): Promise<MentionCandidate[]>;
  findSymbols(query: string): Promise<MentionCandidate[]>;
}

export class MentionResolver {
  constructor(
    private readonly db: ClientLiaisonDB,
    private readonly host: MentionExtensionHost | null = null,
  ) {}

  async resolve(
    rawQuery: string,
    types?: MentionType[],
  ): Promise<MentionCandidate[]> {
    const query = rawQuery.trim().toLowerCase();
    const want = (t: MentionType) => !types || types.includes(t);

    const results: MentionCandidate[] = [];

    if (want('file') && this.host) {
      try {
        results.push(...(await this.host.findFiles(query)));
      } catch { /* host failures are non-fatal */ }
    }

    if (want('symbol') && this.host) {
      try {
        results.push(...(await this.host.findSymbols(query)));
      } catch { /* host failures are non-fatal */ }
    }

    if (want('decision')) results.push(...this.findDecisions(query));
    if (want('constraint')) results.push(...this.findConstraints(query));
    if (want('phase')) results.push(...this.findPhases(query));
    if (want('run')) results.push(...this.findRuns(query));

    return results.slice(0, 20);
  }

  private findDecisions(query: string): MentionCandidate[] {
    if (!query) return [];
    const records = this.db.ftsSearch(query, { recordType: 'decision_trace', limit: 5 });
    return records.map(r => ({
      type: 'decision' as const,
      id: r.id,
      label: `decision · phase ${r.phase_id ?? '-'}`,
      detail: JSON.stringify(r.content).slice(0, 80),
    }));
  }

  private findConstraints(query: string): MentionCandidate[] {
    if (!query) return [];
    // Constraints are stored as artifact_produced records with content.kind === 'constraint'.
    const records = this.db.ftsSearch(query, {
      recordType: 'artifact_produced',
      limit: 10,
    });
    return records
      .filter(r => (r.content as { kind?: string }).kind === 'constraint')
      .slice(0, 5)
      .map(r => ({
        type: 'constraint' as const,
        id: r.id,
        label: `constraint`,
        detail: (r.content as { statement?: string }).statement,
      }));
  }

  private findPhases(query: string): MentionCandidate[] {
    // Phase mentions look like "phase:1" or "phase:0.workspace_classification".
    const m = /^phase:?(\d+(?:\.\d+\w*)?)/.exec(query);
    if (!m) return [];
    const phaseId = m[1].split('.')[0];
    const records = this.db.getRecordsByPhase(phaseId as never);
    return records.slice(0, 5).map(r => ({
      type: 'phase' as const,
      id: r.id,
      label: `phase ${r.phase_id} · ${r.record_type}`,
      detail: JSON.stringify(r.content).slice(0, 80),
    }));
  }

  private findRuns(query: string): MentionCandidate[] {
    // Run mentions look like "run:abc" or "run:2026-04-11".
    const m = /^run:?(\S+)/.exec(query);
    if (!m) return [];
    const fragment = m[1];
    const current = this.db.getCurrentWorkflowRun();
    if (current && (current.id.includes(fragment) || current.initiated_at.includes(fragment))) {
      return [{
        type: 'run',
        id: current.id,
        label: `run · ${current.id.slice(0, 8)}`,
        detail: `started ${current.initiated_at}`,
      }];
    }
    return [];
  }
}
