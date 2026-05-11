/**
 * LNFR three-pass bloom (Proposal C-shaped).
 *
 * Per docs/janumilegal_product_description_evolution.md §5.3:
 *   "LNFRs are bloomed and saturated per matter, using the same recursive
 *    decomposition discipline as legal Issue Bloom (§7), with LNFR-specific
 *    seed sets."
 *
 * Wave 8 ships a deterministic three-pass orchestrator. Wave 9+ may swap in
 * an LLM-backed agent for richer findings.
 */

import { randomUUID } from 'node:crypto';
import { LNFR_DOMAINS, type LNFRDomain } from './domains.js';
import type { LnfrBloomResult, LnfrFinding } from './types.js';

export interface LnfrBloomInput {
  readonly seedDomains?: readonly LNFRDomain[]; // defaults to ALL LNFR_DOMAINS
  readonly matterContextSummary: string;
}

export interface LnfrBloomAgent {
  pass1(input: LnfrBloomInput): { findings: readonly LnfrFinding[]; nonApplicable: readonly LNFRDomain[] };
  pass2(input: LnfrBloomInput, prior: readonly LnfrFinding[]): { findings: readonly LnfrFinding[]; attestation?: { type: 'no_off_domain_plausible'; basis: string } };
  pass3(input: LnfrBloomInput, prior: readonly LnfrFinding[]): { findings: readonly LnfrFinding[] };
}

export class LnfrBloomViolation extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'LnfrBloomViolation';
  }
}

export class LnfrThreePassBloom {
  constructor(private readonly agent: LnfrBloomAgent) {}

  run(input: LnfrBloomInput): LnfrBloomResult {
    const seeds = input.seedDomains ?? (LNFR_DOMAINS as readonly LNFRDomain[]);
    const seedSet = new Set<string>(seeds);

    // Pass 1 — SEED COVERAGE
    const p1 = this.agent.pass1(input);
    // every seed must produce a finding or a non-applicability record
    const p1Domains = new Set(p1.findings.map((f) => f.domain));
    const naSet = new Set(p1.nonApplicable);
    const missing = seeds.filter((d) => !p1Domains.has(d) && !naSet.has(d));
    if (missing.length > 0) {
      throw new LnfrBloomViolation(
        `pass 1 did not cover seed domains: ${missing.join(', ')}`,
        'SEED_COVERAGE_VIOLATED',
      );
    }
    const p1OffSeed = p1.findings.filter((f) => !seedSet.has(f.domain));
    if (p1OffSeed.length > 0) {
      throw new LnfrBloomViolation(
        `pass 1 introduced off-domain findings: ${p1OffSeed.map((f) => f.domain).join(', ')}`,
        'PASS1_OFFDOMAIN_VIOLATION',
      );
    }

    // Pass 2 — DIVERGENCE
    const priorAfter1 = p1.findings;
    const p2Domains = new Set(priorAfter1.map((f) => f.domain));
    const p2 = this.agent.pass2(input, priorAfter1);
    const offDomain = p2.findings.filter((f) => !seedSet.has(f.domain) && !p2Domains.has(f.domain));
    if (offDomain.length === 0 && !p2.attestation) {
      throw new LnfrBloomViolation(
        'pass 2 produced no off-domain finding and no attestation; one or the other is required',
        'DIVERGENCE_REQUIRED',
      );
    }
    const merged = mergeById([...priorAfter1], p2.findings);

    // Pass 3 — CONSOLIDATION + DAMPENING
    const passTwoDomains = new Set(merged.map((f) => f.domain));
    const p3 = this.agent.pass3(input, merged);
    const lateAdditions = p3.findings.filter((f) => !passTwoDomains.has(f.domain));
    if (lateAdditions.length > 0) {
      return {
        status: 'escalated',
        findings: merged,
        nonApplicableDomains: p1.nonApplicable,
        escalationReason: `pass 3 introduced ${lateAdditions.length} new LNFR domain(s): ${lateAdditions.map((f) => f.domain).join(', ')}`,
      };
    }

    // Pass 3 may refine/restate; use its final set
    const final = mergeById(merged, p3.findings);
    return { status: 'completed', findings: final, nonApplicableDomains: p1.nonApplicable };
  }
}

function mergeById(prior: LnfrFinding[], next: readonly LnfrFinding[]): LnfrFinding[] {
  const m = new Map<string, LnfrFinding>();
  for (const p of prior) m.set(p.findingId, p);
  for (const n of next) m.set(n.findingId, n);
  return Array.from(m.values());
}

/** Helper for tests — produce a clean LNFR finding with a generated id. */
export function lnfrFinding(args: Omit<LnfrFinding, 'findingId'>): LnfrFinding {
  return { findingId: randomUUID(), ...args };
}
