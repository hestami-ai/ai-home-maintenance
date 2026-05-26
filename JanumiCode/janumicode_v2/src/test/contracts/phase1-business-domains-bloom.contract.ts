/**
 * Contract for Phase 1.2 — business_domains_bloom (artifact kind: `business_domains_bloom`).
 *
 * Business domains are referenced by Phase 4 software_domains via
 * maps_to_business_domains (Gap #8). They use the DOM-* uppercase id
 * convention.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface Persona {
  id: string;
  name?: string;
  description?: string;
  role?: string;
}

export interface BusinessDomain {
  id: string;
  name?: string;
  description?: string;
  personas?: Persona[];
  source?: string;
}

export interface BusinessDomainsBloomArtifact {
  kind: 'business_domains_bloom';
  businessDomains?: BusinessDomain[];
  domains?: BusinessDomain[];
}

// ── Contract suite ───────────────────────────────────────────────

const DOM_ID_PATTERN = /^DOM-/;
const PERSONA_ID_PATTERN = /^PERSONA-/;

function getDomains(a: BusinessDomainsBloomArtifact): BusinessDomain[] {
  return a.businessDomains ?? a.domains ?? [];
}

/**
 * Phase 1.2 assigns DOM-* ids. Downstream consumers that cite them
 * include Phase 4 software_domains (maps_to_business_domains) and the
 * system_workflow_bloom (businessDomainId).
 */
const DOM_DOWNSTREAM_CONSUMER_KINDS: ReadonlySet<string> = new Set([
  'software_domains',          // Phase 4.1: maps_to_business_domains
  'system_workflow_bloom',     // Phase 1.3b: workflow.businessDomainId
]);

function collectExternalDomRefs(context: { relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>> }): Set<string> {
  const out = new Set<string>();
  for (const [kind, arr] of context.relatedArtifacts) {
    if (!DOM_DOWNSTREAM_CONSUMER_KINDS.has(kind)) continue;
    for (const a of arr) {
      const blob = JSON.stringify(a);
      for (const m of blob.matchAll(/DOM-[A-Z0-9_-]+/g)) out.add(m[0]);
    }
  }
  return out;
}

export const phase1BusinessDomainsBloomContract: ContractSuite<BusinessDomainsBloomArtifact> = {
  boundaryId: '1.2_business_domains_bloom',
  phaseId: '1',
  subPhaseId: 'business_domains_bloom',
  producerArtifactKind: 'business_domains_bloom',
  description:
    'Phase 1 business domains — non-empty, DOM-* id convention, personas attached where relevant.',
  clauses: [
    {
      id: 'C-1.2.1',
      description: 'business_domains_bloom carries a non-empty array of domains.',
      severity: 'blocking',
      check: (artifact) => {
        const domains = getDomains(artifact);
        if (domains.length === 0) return { message: 'no business domains emitted' };
        return true;
      },
    },
    {
      id: 'C-1.2.2',
      description: 'Every domain has a non-empty DOM-* id, unique within the bloom.',
      severity: 'blocking',
      check: (artifact) => {
        const domains = getDomains(artifact);
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const d of domains) {
          if (!d.id || !DOM_ID_PATTERN.test(d.id)) { bad.push(d.id || '(missing)'); continue; }
          counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
        }
        const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        if (bad.length === 0 && dups.length === 0) return true;
        const parts: string[] = [];
        if (bad.length) parts.push(`${bad.length} malformed id(s)`);
        if (dups.length) parts.push(`duplicates: ${dups.join(', ')}`);
        return { message: parts.join('; '), details: { bad, dups } };
      },
    },
    {
      id: 'C-1.2.3',
      description: 'Every DOM-* id referenced elsewhere in the run resolves in this bloom.',
      severity: 'blocking',
      check: (artifact, context) => {
        const external = collectExternalDomRefs(context);
        if (external.size === 0) return true;
        const known = new Set(getDomains(artifact).map((d) => d.id));
        const unresolved = [...external].filter((id) => !known.has(id));
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} DOM-* ref(s) elsewhere do not resolve`,
          details: { unresolved: unresolved.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-1.2.4',
      description: 'Personas (when present) have PERSONA-* ids.',
      severity: 'advisory',
      check: (artifact) => {
        const bad: Array<{ domainId: string; personaId: string }> = [];
        for (const d of getDomains(artifact)) {
          for (const p of d.personas ?? []) {
            if (!p.id || !PERSONA_ID_PATTERN.test(p.id)) bad.push({ domainId: d.id, personaId: p.id || '(missing)' });
          }
        }
        if (bad.length === 0) return true;
        return { message: `${bad.length} persona(s) have malformed id`, details: { bad } };
      },
    },
  ],
};
