/**
 * Layer 3 — firm configuration types.
 *
 * Per docs/janumilegal_product_description.md §Layer 3: Firm Configuration.
 *
 * A firm config is data, not code. It supplies firm-specific settings the
 * platform consumes at runtime: practice areas, jurisdictions, retention
 * policies, release-policy slots, citator providers, brief-bank scrubbing
 * tokens, etc.
 *
 * Layer 3 may import from Layer 1 and Layer 2. Layer 1 may NOT import from
 * Layer 3 — the platform stays firm-agnostic.
 */

import type { CitatorTreatment } from '../lib/authority/types.js';
import type { FirmReleasePolicy } from '../lib/releaseGate/types.js';
import type { AuthorityFreshnessPolicy } from '../lib/lensVersioning/types.js';
import type { AgentRoutingConfig } from '../lib/agents/routing.js';

/**
 * Per-state agent routing — re-exported from Layer 1 so Layer 2 agent
 * factories can consume the same shape without violating layer-import rules.
 *
 * `kind` selects the agent execution path:
 *   - 'llm'  — LlmBackedAgent: single-shot LLM provider call
 *   - 'cli'  — CliBackedAgent : sandboxed agentic-CLI subprocess (Goose / Claude Code / Codex / Gemini)
 *   - 'replay' — replay agent (test fixture; thin-slice structural mode)
 */
export type { StateAgentRouting } from '../lib/agents/routing.js';

/** Layer-3 alias: a firm's `llmRouting` slot is a Layer-1 `AgentRoutingConfig`. */
export type FirmLlmRouting = AgentRoutingConfig;

export interface FirmConfig {
  readonly firmId: string;
  readonly displayName: string;
  readonly primaryJurisdiction: string;
  readonly practiceAreas: readonly string[];
  readonly enabledLensIds: readonly string[];
  /** Jurisdictions where the firm's attorneys are typically admitted. */
  readonly admittedJurisdictions: readonly string[];
  /** Retention defaults per matter type. */
  readonly retentionDays: Readonly<Record<string, number>>;
  /** Release policy slot consumed by the Release Gate Evaluator. */
  readonly releasePolicy: FirmReleasePolicy;
  /** Per-firm citator provider configuration: jurisdictions to scope and (optional) seeded data. */
  readonly citatorJurisdictionScope: readonly string[];
  readonly citatorSeed?: ReadonlyArray<{ authorityId: string; treatment: CitatorTreatment }>;
  /** Default tokens to scrub when promoting matter content to the brief bank. */
  readonly briefBankScrubTokenCategories: readonly ('client_name' | 'opposing_party_name' | 'specific_dates')[];
  /** Authority freshness policy. */
  readonly authorityFreshness: AuthorityFreshnessPolicy;
  /** Wave 10: agent routing per state. Optional — when absent, replay agents stand in. */
  readonly llmRouting?: FirmLlmRouting;
}
