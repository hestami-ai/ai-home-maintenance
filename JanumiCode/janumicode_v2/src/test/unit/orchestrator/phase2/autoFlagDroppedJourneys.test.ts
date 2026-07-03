/**
 * Phase 2.1 enumeration-discipline backstop — the FR/journey analog of
 * autoFlagDroppedSeeds. cal-32: gpt-oss:20b created 12 journeys but neither
 * traced an FR to UJ-SCHEDULE-APPOINTMENT nor declared it unreached → the
 * journey_fr_coverage verifier hard-failed P2.1c. autoFlagDroppedJourneys
 * auto-declares such journeys as unreached so the verifier sees them as
 * acknowledged-pending-review, not missing.
 */
import { describe, it, expect } from 'vitest';
import { autoFlagDroppedJourneys, SYSTEM_INFERRED_JOURNEY_REASON } from '../../../../lib/orchestrator/phases/phase2/autoFlagDroppedJourneys';

describe('autoFlagDroppedJourneys', () => {
  it('auto-flags a journey neither traced nor declared (the cal-32 gpt-oss defect)', () => {
    const r = autoFlagDroppedJourneys({
      journeys: [{ id: 'UJ-SCHEDULE-REPAIR' }, { id: 'UJ-SCHEDULE-APPOINTMENT' }],
      userStories: [{ traces_to: ['UJ-SCHEDULE-REPAIR', 'ENT-CASE'] }],
      unreachedJourneys: [],
    });
    expect(r.autoFlagged.map(u => u.journey_id)).toEqual(['UJ-SCHEDULE-APPOINTMENT']);
    expect(r.unreachedJourneys).toContainEqual({ journey_id: 'UJ-SCHEDULE-APPOINTMENT', reason: SYSTEM_INFERRED_JOURNEY_REASON });
  });

  it('does NOT flag journeys already traced by an FR', () => {
    const r = autoFlagDroppedJourneys({
      journeys: [{ id: 'UJ-A' }],
      userStories: [{ traces_to: ['UJ-A'] }],
      unreachedJourneys: [],
    });
    expect(r.autoFlagged).toEqual([]);
  });

  it('does NOT flag journeys already declared unreached by the agent', () => {
    const r = autoFlagDroppedJourneys({
      journeys: [{ id: 'UJ-A' }],
      userStories: [],
      unreachedJourneys: [{ journey_id: 'UJ-A', reason: 'deferred to a later release' }],
    });
    expect(r.autoFlagged).toEqual([]);
    expect(r.unreachedJourneys).toHaveLength(1);
  });

  it('preserves existing unreached entries and appends only new auto-flags', () => {
    const r = autoFlagDroppedJourneys({
      journeys: [{ id: 'UJ-A' }, { id: 'UJ-B' }],
      userStories: [{ traces_to: [] }],
      unreachedJourneys: [{ journey_id: 'UJ-A', reason: 'x' }],
    });
    expect(r.unreachedJourneys.map(u => u.journey_id).sort()).toEqual(['UJ-A', 'UJ-B']);
    expect(r.autoFlagged.map(u => u.journey_id)).toEqual(['UJ-B']);
  });
});
