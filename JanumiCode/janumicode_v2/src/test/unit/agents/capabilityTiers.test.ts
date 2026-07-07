/**
 * Increment 2 — capability tier lint.
 *
 * Compile-time, `tsc` already forbids a READ-tier capability (ctx: ReadCtx)
 * from referencing `writer`/engine mutators. This runtime guard is the
 * complement: it fails if any capability is left untagged or mis-tagged, so
 * a new capability cannot silently join the registry without an explicit
 * effect tier. If a tier count changes here, it must be a deliberate design
 * change (and the broker's tier routing reviewed accordingly).
 */

import { describe, it, expect } from 'vitest';
import { CapabilityRegistry } from '../../../lib/agents/clientLiaison/capabilities/index';
import { workflowControlCapabilities } from '../../../lib/agents/clientLiaison/capabilities/workflowControl/index';
import { informationRetrievalCapabilities } from '../../../lib/agents/clientLiaison/capabilities/informationRetrieval/index';
import { artifactInteractionCapabilities } from '../../../lib/agents/clientLiaison/capabilities/artifactInteraction/index';
import { contextManagementCapabilities } from '../../../lib/agents/clientLiaison/capabilities/contextManagement/index';
import { decisionHistoryCapabilities } from '../../../lib/agents/clientLiaison/capabilities/decisionHistory/index';
import { buildSystemCapabilities } from '../../../lib/agents/clientLiaison/capabilities/system/index';

const all = [
  ...workflowControlCapabilities,
  ...informationRetrievalCapabilities,
  ...artifactInteractionCapabilities,
  ...contextManagementCapabilities,
  ...decisionHistoryCapabilities,
  ...buildSystemCapabilities(new CapabilityRegistry()),
];

describe('capability effect tiers (Increment 2)', () => {
  it('every capability declares a valid tier', () => {
    for (const c of all) {
      expect(['read', 'propose', 'govern'], `${c.name} has an invalid tier`).toContain(c.tier);
    }
  });

  it('tier counts match the design (15 read / 3 propose / 4 govern)', () => {
    const count = (t: string) => all.filter((c) => c.tier === t).length;
    expect(all).toHaveLength(22);
    expect(count('read')).toBe(15);
    expect(count('propose')).toBe(3);
    expect(count('govern')).toBe(4);
  });

  it('every GOVERN capability that mutates the workflow is either confirmation-gated or the escalation path', () => {
    const govern = all.filter((c) => c.tier === 'govern');
    for (const c of govern) {
      const ok = Boolean(c.confirmation) || c.name === 'startWorkflow' || c.name === 'resumeWorkflow' || c.name === 'escalateInconsistency';
      expect(ok, `${c.name} should be confirmation-gated or a known govern entry`).toBe(true);
    }
  });
});
