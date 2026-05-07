import { describe, it, expect } from 'vitest';
import { validateAdrStatusDiscipline } from '../../../../../../lib/review/harness/validators/deterministic/adrStatusDisciplineValidator';
import { makeRuntime } from './_helpers';

describe('adr_status_discipline_validator (deterministic)', () => {
  it('returns [] when no adrs field', () => {
    expect(validateAdrStatusDiscipline(makeRuntime({ outputContent: {} }))).toEqual([]);
  });

  it('returns [] when all ADRs are proposed', () => {
    expect(
      validateAdrStatusDiscipline(
        makeRuntime({
          outputContent: {
            adrs: [
              { id: 'ADR-001', title: 'Use PostgreSQL', status: 'proposed' },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('returns [] when accepted ADR has a rationale', () => {
    expect(
      validateAdrStatusDiscipline(
        makeRuntime({
          outputContent: {
            adrs: [
              { id: 'ADR-001', title: 'Use PostgreSQL', status: 'accepted', accepted_rationale: 'Approved by architecture board on 2026-04-01.' },
            ],
          },
        }),
      ),
    ).toEqual([]);
  });

  it('flags MEDIUM when single accepted ADR lacks rationale', () => {
    const findings = validateAdrStatusDiscipline(
      makeRuntime({
        outputContent: {
          adrs: [
            { id: 'ADR-001', title: 'Use PostgreSQL', status: 'accepted' },
            { id: 'ADR-002', title: 'Use Redis', status: 'proposed' },
          ],
        },
      }),
    );
    expect(findings.some((f) => f.severity === 'MEDIUM' && f.type === 'accepted_without_rationale')).toBe(true);
  });

  it('downgrades to LOW when all ADRs accepted without rationale (aggregate pattern)', () => {
    const findings = validateAdrStatusDiscipline(
      makeRuntime({
        outputContent: {
          adrs: [
            { id: 'ADR-001', status: 'accepted' },
            { id: 'ADR-002', status: 'accepted' },
            { id: 'ADR-003', status: 'accepted' },
          ],
        },
      }),
    );
    expect(findings.length).toBe(3);
    expect(findings.every((f) => f.severity === 'LOW')).toBe(true);
  });
});
