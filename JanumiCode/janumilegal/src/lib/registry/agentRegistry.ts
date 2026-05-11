/**
 * Agent Registry — types + capability-group exclusivity check.
 *
 * Per:
 *   - docs/janumilegal_product_description.md §JanumiLegal Agent Registry
 *   - docs/janumilegal_product_description_evolution.md §14
 *
 * Capability-group exclusivity rule (evolution §14):
 *   A single registry entry may declare AT MOST ONE capability from each
 *   of the three mutually exclusive groups. This is enforced at registration.
 */

export const AGENT_TIERS = [
  'intake',
  'lens_selection',
  'matter_framing',
  'issue_decomposition',
  'fact_source_analysis',
  'authority_analysis',
  'artifact_planning',
  'draft_generation',
  'verification',
  'professional_review',
  'release_governance',
  'meta_review',
] as const;
export type AgentTier = (typeof AGENT_TIERS)[number];

// Group A — production capabilities
export const GROUP_A_CAPS = ['classify', 'extract', 'summarize', 'decompose', 'retrieve', 'map', 'draft', 'redline'] as const;
// Group B — assessment capabilities
export const GROUP_B_CAPS = ['verify', 'critique'] as const;
// Group C — governance capabilities
export const GROUP_C_CAPS = ['gate', 'escalate', 'package'] as const;

export type GroupACap = (typeof GROUP_A_CAPS)[number];
export type GroupBCap = (typeof GROUP_B_CAPS)[number];
export type GroupCCap = (typeof GROUP_C_CAPS)[number];

const GROUP_A = new Set<string>(GROUP_A_CAPS);
const GROUP_B = new Set<string>(GROUP_B_CAPS);
const GROUP_C = new Set<string>(GROUP_C_CAPS);

export interface ConfidencePolicy {
  readonly mayUseConfidenceLabels: boolean;
  readonly mayBlockRelease: boolean;
  readonly mayRequireAttorneyReview: boolean;
  readonly mayApproveRelease: boolean;
}

export interface AuthorityPolicy {
  readonly mayRetrieveAuthority: boolean;
  readonly mayAssessAuthoritySupport: boolean;
  readonly mayMarkAttorneyConfirmed: boolean;
}

export interface PrivilegePolicy {
  readonly mayHandlePrivilegedMaterial: boolean;
  readonly mayGenerateClientFacingText: boolean;
  readonly mayExportExternalArtifact: boolean;
}

export interface AgentRegistryEntry {
  readonly agentId: string;
  readonly displayName: string;
  readonly tier: AgentTier;
  readonly permittedLenses: readonly string[];
  readonly permittedStates: readonly string[];

  // Capability-group exclusivity: at most one from each group.
  readonly capabilityGroupA?: GroupACap;
  readonly capabilityGroupB?: GroupBCap;
  readonly capabilityGroupC?: GroupCCap;

  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly prohibitedActions: readonly string[];
  readonly requiredValidators: readonly string[];
  readonly confidencePolicy: ConfidencePolicy;
  readonly authorityPolicy: AuthorityPolicy;
  readonly privilegePolicy: PrivilegePolicy;
  readonly version: string;
}

export interface RegistryValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateRegistryEntry(entry: AgentRegistryEntry): RegistryValidationResult {
  const errors: string[] = [];

  if (!entry.agentId) errors.push('missing agentId');
  if (!entry.tier) errors.push('missing tier');
  if (!entry.inputSchema) errors.push('missing inputSchema');
  if (!entry.outputSchema) errors.push('missing outputSchema');
  if (!entry.confidencePolicy) errors.push('missing confidencePolicy');
  if (!entry.authorityPolicy) errors.push('missing authorityPolicy');
  if (!entry.privilegePolicy) errors.push('missing privilegePolicy');

  // Capability-group exclusivity: each group's value must come from its own group only.
  if (entry.capabilityGroupA && !GROUP_A.has(entry.capabilityGroupA)) {
    errors.push(`capabilityGroupA value '${entry.capabilityGroupA}' not in Group A`);
  }
  if (entry.capabilityGroupB && !GROUP_B.has(entry.capabilityGroupB)) {
    errors.push(`capabilityGroupB value '${entry.capabilityGroupB}' not in Group B`);
  }
  if (entry.capabilityGroupC && !GROUP_C.has(entry.capabilityGroupC)) {
    errors.push(`capabilityGroupC value '${entry.capabilityGroupC}' not in Group C`);
  }

  // At least one capability declared
  if (!entry.capabilityGroupA && !entry.capabilityGroupB && !entry.capabilityGroupC) {
    errors.push('agent must declare at least one capability (Group A, B, or C)');
  }

  // mayApproveRelease must be false for non-human agents (almost always)
  if (entry.confidencePolicy.mayApproveRelease) {
    errors.push('mayApproveRelease must be false for AI agents; only human attorney roles approve');
  }

  return { ok: errors.length === 0, errors };
}

export class AgentRegistry {
  private readonly entries = new Map<string, AgentRegistryEntry>();

  register(entry: AgentRegistryEntry): void {
    const v = validateRegistryEntry(entry);
    if (!v.ok) {
      throw new Error(`agent registration failed for ${entry.agentId}: ${v.errors.join('; ')}`);
    }
    if (this.entries.has(entry.agentId)) {
      throw new Error(`agent ${entry.agentId} already registered`);
    }
    this.entries.set(entry.agentId, entry);
  }

  get(agentId: string): AgentRegistryEntry | undefined {
    return this.entries.get(agentId);
  }

  list(): AgentRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  has(agentId: string): boolean {
    return this.entries.has(agentId);
  }
}
