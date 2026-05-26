/**
 * Contract for Phase 4.1 — software_domains (artifact kind: `software_domains`).
 *
 * Codifies design positions from
 *   docs/design/contract-harness-stage1b-design-positions.md, Gap #8.
 *
 * `software_domains.domains[].maps_to_business_domains` MUST be non-empty
 * for every software domain — the canonical bridge between Phase 4's
 * `domain-*` lowercase namespace and Phase 1's `DOM-*` caps namespace.
 */

import type { ContractSuite } from './types';

// ── Producer artifact shape ─────────────────────────────────────

export interface SoftwareDomain {
  id: string;
  name?: string;
  description?: string;
  maps_to_business_domains?: string[];
}

export interface SoftwareDomainsArtifact {
  kind: 'software_domains';
  domains: SoftwareDomain[];
}

// ── Contract suite ───────────────────────────────────────────────

const SW_DOMAIN_ID_PATTERN = /^domain-/;
const BIZ_DOMAIN_ID_PATTERN = /^DOM-/;

export const phase4SoftwareDomainsContract: ContractSuite<SoftwareDomainsArtifact> = {
  boundaryId: '4.1_software_domains',
  phaseId: '4',
  subPhaseId: 'software_domains',
  producerArtifactKind: 'software_domains',
  description:
    'Phase 4 software_domains — every domain maps to one or more Phase 1 business_domains (Gap #8).',
  clauses: [
    {
      id: 'C-4.1.1',
      description: 'software_domains.domains is a non-empty array.',
      severity: 'blocking',
      check: (artifact) => {
        if (!Array.isArray(artifact.domains) || artifact.domains.length === 0) {
          return { message: 'domains is missing or empty' };
        }
        return true;
      },
    },
    {
      id: 'C-4.1.2',
      description: 'Every domain has a non-empty domain-* id, unique within the artifact.',
      severity: 'blocking',
      check: (artifact) => {
        const counts = new Map<string, number>();
        const bad: string[] = [];
        for (const d of artifact.domains) {
          if (!d.id || !SW_DOMAIN_ID_PATTERN.test(d.id)) { bad.push(d.id || '(missing)'); continue; }
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
      id: 'C-4.1.3',
      description: 'Every domain has a non-empty maps_to_business_domains array citing DOM-* ids (Gap #8).',
      severity: 'blocking',
      check: (artifact) => {
        const bad: Array<{ id: string; reason: string }> = [];
        for (const d of artifact.domains) {
          if (!Array.isArray(d.maps_to_business_domains) || d.maps_to_business_domains.length === 0) {
            bad.push({ id: d.id, reason: 'empty maps_to_business_domains' });
            continue;
          }
          const valid = d.maps_to_business_domains.filter((b) => BIZ_DOMAIN_ID_PATTERN.test(b));
          if (valid.length === 0) bad.push({ id: d.id, reason: 'no DOM-* refs' });
        }
        if (bad.length === 0) return true;
        return {
          message: `${bad.length} domain(s) violate Gap #8 maps_to_business_domains requirement`,
          details: { issues: bad.slice(0, 10) },
        };
      },
    },
    {
      id: 'C-4.1.4',
      description: 'Every maps_to_business_domains entry resolves to a domain in business_domains_bloom.',
      severity: 'advisory',
      check: (artifact, context) => {
        const bds = context.relatedArtifacts.get('business_domains_bloom') ?? [];
        if (bds.length === 0) return true;
        const known = new Set<string>();
        for (const bd of bds) {
          const items = (bd as { businessDomains?: Array<{ id?: string }>; domains?: Array<{ id?: string }>; items?: Array<{ id?: string }> });
          const list = items.businessDomains ?? items.domains ?? items.items ?? [];
          for (const x of list) if (x.id) known.add(x.id);
        }
        const unresolved: Array<{ swDomain: string; bizDomain: string }> = [];
        for (const d of artifact.domains) {
          for (const b of d.maps_to_business_domains ?? []) {
            if (!known.has(b)) unresolved.push({ swDomain: d.id, bizDomain: b });
          }
        }
        if (unresolved.length === 0) return true;
        return {
          message: `${unresolved.length} maps_to_business_domains ref(s) do not resolve`,
          details: { unresolved },
        };
      },
    },
  ],
};
