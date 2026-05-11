/**
 * Reviewer Assignment Agent (Tier 11 #49).
 *
 * Per docs/janumilegal_product_description.md §Tier 11 #49:
 *   "Route artifacts to the correct attorney, partner, practice lead, or
 *    reviewer based on firm policy. This may be deterministic policy logic."
 *
 * Wave 7 ships deterministic routing rules driven by:
 *   - artifact type
 *   - target release audience
 *   - matter risk level
 *   - jurisdiction
 *
 * The agent does NOT approve release; it only routes. Approval is an
 * AttorneyAction recorded by the assigned reviewer.
 */

import { randomUUID } from 'node:crypto';
import { summarize, type GovernanceFinding, type GovernanceReport } from './types.js';

export const REVIEWER_ASSIGNMENT_AGENT_ID = 'reviewer_assignment_agent.v1';

export type ReviewerRole = 'reviewer' | 'supervising_attorney' | 'attorney_of_record' | 'signing_attorney' | 'approving_partner';

export interface ReviewerCandidate {
  readonly attorneyId: string;
  readonly displayName: string;
  readonly admittedJurisdictions: readonly string[];
  readonly availability: 'available' | 'busy' | 'unavailable';
  readonly practiceAreas: readonly string[];
}

export interface AssignmentRequest {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly releaseTarget: 'internal' | 'client' | 'opposing' | 'court' | 'agency' | 'public';
  readonly riskLevel: 'Low' | 'Medium' | 'High';
  readonly forumJurisdiction?: string;
  readonly practiceArea: string;
  readonly candidates: readonly ReviewerCandidate[];
  /** Existing reviewers already assigned (e.g., conflicts officer pre-screen). */
  readonly existingReviewerIds?: readonly string[];
}

export interface AssignmentDecision {
  readonly artifactId: string;
  readonly assignedAttorneyId: string;
  readonly assignedRole: ReviewerRole;
  readonly basis: string;
}

export interface AssignmentResult {
  readonly decisions: readonly AssignmentDecision[];
  readonly report: GovernanceReport;
}

export class ReviewerAssignmentAgent {
  assign(req: AssignmentRequest): AssignmentResult {
    const findings: GovernanceFinding[] = [];
    const decisions: AssignmentDecision[] = [];
    const existing = new Set(req.existingReviewerIds ?? []);

    // Required reviewer roles by release target
    const requiredRoles = this.requiredRolesForTarget(req.releaseTarget, req.riskLevel);

    for (const role of requiredRoles) {
      const cand = this.pickCandidate(role, req, existing);
      if (!cand) {
        findings.push({
          findingId: randomUUID(),
          agentId: REVIEWER_ASSIGNMENT_AGENT_ID,
          severity: 'block',
          category: 'no_eligible_reviewer',
          message: `no eligible reviewer for role '${role}' (artifact ${req.artifactId})`,
          subject: { kind: 'artifact', id: req.artifactId },
        });
        continue;
      }
      decisions.push({
        artifactId: req.artifactId,
        assignedAttorneyId: cand.attorneyId,
        assignedRole: role,
        basis: this.basisForCandidate(cand, role, req),
      });
      existing.add(cand.attorneyId);
    }

    return {
      decisions,
      report: {
        reportId: randomUUID(),
        producedBy: REVIEWER_ASSIGNMENT_AGENT_ID,
        producedAt: new Date().toISOString(),
        findings,
        summary: summarize(findings),
      },
    };
  }

  private requiredRolesForTarget(target: AssignmentRequest['releaseTarget'], risk: AssignmentRequest['riskLevel']): readonly ReviewerRole[] {
    switch (target) {
      case 'internal':
        return ['reviewer'];
      case 'client':
        return risk === 'High' ? ['reviewer', 'supervising_attorney'] : ['reviewer'];
      case 'opposing':
      case 'agency':
        return ['reviewer', 'supervising_attorney'];
      case 'court':
        // Filing requires a signing attorney admitted in the forum.
        return ['reviewer', 'signing_attorney'];
      case 'public':
        return ['reviewer', 'approving_partner'];
    }
  }

  private pickCandidate(role: ReviewerRole, req: AssignmentRequest, exclude: ReadonlySet<string>): ReviewerCandidate | undefined {
    const available = req.candidates.filter((c) => c.availability !== 'unavailable' && !exclude.has(c.attorneyId));
    const practiceMatch = available.filter((c) => c.practiceAreas.includes(req.practiceArea));

    let pool = practiceMatch.length > 0 ? practiceMatch : available;

    if (role === 'signing_attorney') {
      if (!req.forumJurisdiction) return undefined;
      pool = pool.filter((c) => c.admittedJurisdictions.includes(req.forumJurisdiction!));
    }

    // Prefer 'available' over 'busy'
    pool.sort((a, b) => (a.availability === 'available' ? -1 : 1) - (b.availability === 'available' ? -1 : 1));
    return pool[0];
  }

  private basisForCandidate(c: ReviewerCandidate, role: ReviewerRole, req: AssignmentRequest): string {
    const parts: string[] = [`role=${role}`];
    if (c.practiceAreas.includes(req.practiceArea)) parts.push(`practiceArea=${req.practiceArea}`);
    if (role === 'signing_attorney' && req.forumJurisdiction) parts.push(`admitted_in=${req.forumJurisdiction}`);
    parts.push(`availability=${c.availability}`);
    return parts.join('; ');
  }
}
