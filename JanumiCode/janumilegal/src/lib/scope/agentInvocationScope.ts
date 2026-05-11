/**
 * AgentInvocationScope envelope.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §5.1.
 *
 * Every agent invocation MUST receive a scope envelope. Prompt assembly reads
 * only from this envelope; no global retrieval, no cross-matter examples.
 *
 * Wave 0: defines the type. Wave 2 wires it through the agent runtime.
 */

import type { Scope } from '../database/types.js';

export interface SourceRef {
  readonly sourceId: string;
  readonly documentType: string;
  readonly contentHash: string;
}

export interface ArtifactRef {
  readonly artifactId: string;
  readonly versionHash: string;
}

export interface MMPRef {
  readonly mmpId: string;
}

export interface PrivilegeFrameSnapshot {
  readonly snapshotHash: string;
  readonly version: number;
}

export interface ForbiddenScope {
  readonly matterId: string;
  readonly reason: string;
}

export interface AgentInvocationScope extends Scope {
  readonly lensId: string;
  readonly lensVersion: string;
  readonly stateId: string;
  readonly privilegeFrame: PrivilegeFrameSnapshot;
  readonly authorizedSources: readonly SourceRef[];
  readonly authorizedPriorArtifacts: readonly ArtifactRef[];
  readonly authorizedMMP: readonly MMPRef[];
  readonly forbiddenScopes: readonly ForbiddenScope[];
}

/**
 * Validates that an envelope is internally consistent.
 * Wave 2 expands this with cross-checks against the DAL and CLV.
 */
export function validateEnvelope(env: AgentInvocationScope): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!env.firmId || !env.clientId || !env.matterId) errors.push('missing scope tuple');
  if (!env.lensId || !env.lensVersion) errors.push('missing lens id/version');
  if (!env.stateId) errors.push('missing stateId');
  if (!env.privilegeFrame) errors.push('missing privilegeFrame snapshot');
  for (const f of env.forbiddenScopes) {
    if (f.matterId === env.matterId) {
      errors.push(`forbiddenScope cannot include the active matter: ${f.matterId}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
