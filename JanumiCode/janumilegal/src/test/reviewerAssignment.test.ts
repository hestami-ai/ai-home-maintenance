import { describe, it, expect } from 'vitest';
import { ReviewerAssignmentAgent, type ReviewerCandidate } from '../lib/agents/governance/reviewerAssignment.js';

const candidates: ReviewerCandidate[] = [
  { attorneyId: 'partner_md', displayName: 'Partner MD', admittedJurisdictions: ['MD', 'DC'], availability: 'available', practiceAreas: ['family_law', 'business_civil'] },
  { attorneyId: 'reviewer_md', displayName: 'Reviewer MD', admittedJurisdictions: ['MD'], availability: 'available', practiceAreas: ['family_law'] },
  { attorneyId: 'reviewer_va', displayName: 'Reviewer VA', admittedJurisdictions: ['VA'], availability: 'available', practiceAreas: ['family_law'] },
  { attorneyId: 'unavailable', displayName: 'X', admittedJurisdictions: ['MD'], availability: 'unavailable', practiceAreas: ['family_law'] },
];

describe('Reviewer Assignment Agent', () => {
  const agent = new ReviewerAssignmentAgent();

  it('internal release picks a single reviewer', () => {
    const r = agent.assign({
      artifactId: 'art1', artifactType: 'research_memo', releaseTarget: 'internal', riskLevel: 'Low',
      practiceArea: 'family_law', candidates,
    });
    expect(r.decisions).toHaveLength(1);
    expect(r.decisions[0].assignedRole).toBe('reviewer');
  });

  it('high-risk client release requires reviewer + supervising_attorney', () => {
    const r = agent.assign({
      artifactId: 'art1', artifactType: 'client_advice_draft', releaseTarget: 'client', riskLevel: 'High',
      practiceArea: 'family_law', candidates,
    });
    const roles = r.decisions.map((d) => d.assignedRole).sort();
    expect(roles).toEqual(['reviewer', 'supervising_attorney']);
  });

  it('court filing requires a signing_attorney admitted in the forum', () => {
    const r = agent.assign({
      artifactId: 'art1', artifactType: 'court_filing_draft', releaseTarget: 'court', riskLevel: 'High',
      forumJurisdiction: 'MD', practiceArea: 'family_law', candidates,
    });
    const signing = r.decisions.find((d) => d.assignedRole === 'signing_attorney');
    expect(signing).toBeDefined();
    expect(signing!.assignedAttorneyId).toMatch(/^(partner_md|reviewer_md)$/);
  });

  it('court filing FAILS when no candidate is admitted in the forum', () => {
    const r = agent.assign({
      artifactId: 'art1', artifactType: 'court_filing_draft', releaseTarget: 'court', riskLevel: 'High',
      forumJurisdiction: 'PA', practiceArea: 'family_law', candidates,
    });
    expect(r.report.summary.block).toBeGreaterThanOrEqual(1);
    expect(r.report.findings.some((f) => f.category === 'no_eligible_reviewer')).toBe(true);
  });

  it('public release requires approving_partner', () => {
    const r = agent.assign({
      artifactId: 'art1', artifactType: 'public_announcement', releaseTarget: 'public', riskLevel: 'Medium',
      practiceArea: 'family_law', candidates,
    });
    const roles = r.decisions.map((d) => d.assignedRole).sort();
    expect(roles).toEqual(['approving_partner', 'reviewer']);
  });
});
