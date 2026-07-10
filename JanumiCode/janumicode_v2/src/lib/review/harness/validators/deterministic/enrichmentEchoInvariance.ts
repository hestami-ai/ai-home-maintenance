/**
 * Deterministic validator: enrichment_echo_invariance
 *
 * Per validator_catalog.md §5.2 + sample 10. Verify that every story
 * present in the prior skeleton-pass output is still present in the
 * enrichment output with id/role/action/outcome unchanged.
 *
 * The skeleton substrate is consumed via `params.upstreamFindings` —
 * Commit 3 accepts a degraded mode where substrate is absent (no
 * substrate -> no findings; we simply cannot judge invariance).
 *
 * Substrate shape (when surfaced via upstreamFindings.substrate channel):
 *   { skeletonStories: [{ id, role, action, outcome }] }  (FR)
 *   { skeletonNfrs:    [{ id, category, description }] }  (NFR)
 *
 * Substrate is opaque to the harness today; expose a setter so callers
 * (and tests) can stash the prior pass's stories on the runtime params.
 */

import type { ValidatorRuntimeParams, ValidatorFinding } from '../../validatorRegistry';

/** Render a possibly-object field value for a diagnostic message (avoids '[object Object]'). */
function displayField(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return JSON.stringify(v);
}

interface StoryEcho {
  id: string;
  role?: string;
  action?: string;
  outcome?: string;
}

interface NfrEcho {
  id: string;
  category?: string;
  description?: string;
}

interface SubstrateChannel {
  skeletonStories?: StoryEcho[];
  skeletonNfrs?: NfrEcho[];
}

function getSubstrate(params: ValidatorRuntimeParams): SubstrateChannel | null {
  // Substrate is conventionally stashed on (params as any).substrate by
  // the harness wiring (Commit 5/6). Until then, accept null gracefully.
  const candidate = (params as unknown as { substrate?: SubstrateChannel }).substrate;
  return candidate ?? null;
}

function findStory(stories: unknown, id: string): Record<string, unknown> | null {
  if (!Array.isArray(stories)) return null;
  for (const s of stories) {
    if (s && typeof s === 'object' && (s as Record<string, unknown>).id === id) {
      return s as Record<string, unknown>;
    }
  }
  return null;
}

/** FR enrichment echo: every skeleton story must reappear verbatim in the enrichment output. */
function checkStoryEchoes(
  skeletonStories: StoryEcho[],
  out: Record<string, unknown>,
): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  for (const skel of skeletonStories) {
    const echoed = findStory(out.user_stories, skel.id);
    if (!echoed) {
      findings.push({
        validatorId: 'enrichment_echo_invariance',
        severity: 'HIGH',
        type: 'dropped_story',
        summary: `Story '${skel.id}' from skeleton pass is missing in enrichment output`,
        location: `$.user_stories`,
        detail: `Skeleton story '${skel.id}' was not echoed. Enrichment must echo the spine verbatim.`,
        recommendation: `Restore story '${skel.id}' or flag the omission with rationale.`,
      });
      continue;
    }
    for (const field of ['role', 'action', 'outcome'] as const) {
      if (skel[field] !== undefined && echoed[field] !== skel[field]) {
        findings.push({
          validatorId: 'enrichment_echo_invariance',
          severity: 'HIGH',
          type: 'mutated_field',
          summary: `Story '${skel.id}' field '${field}' mutated between skeleton and enrichment`,
          location: `$.user_stories[id=${skel.id}].${field}`,
          detail: `Skeleton: '${displayField(skel[field])}'\nEnrichment: '${displayField(echoed[field])}'`,
          recommendation: `Echo skeleton '${field}' verbatim; mutations require an explicit revision note.`,
        });
      }
    }
  }
  return findings;
}

/** NFR enrichment echo: every skeleton NFR must reappear verbatim in the enrichment output. */
function checkNfrEchoes(
  skeletonNfrs: NfrEcho[],
  out: Record<string, unknown>,
): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  for (const skel of skeletonNfrs) {
    const echoed = findStory(out.requirements, skel.id);
    if (!echoed) {
      findings.push({
        validatorId: 'enrichment_echo_invariance',
        severity: 'HIGH',
        type: 'dropped_nfr',
        summary: `NFR '${skel.id}' from skeleton pass is missing in enrichment output`,
        location: `$.requirements`,
        detail: `Skeleton NFR '${skel.id}' was not echoed.`,
        recommendation: `Restore NFR '${skel.id}' or flag the omission with rationale.`,
      });
      continue;
    }
    for (const field of ['category', 'description'] as const) {
      if (skel[field] !== undefined && echoed[field] !== skel[field]) {
        findings.push({
          validatorId: 'enrichment_echo_invariance',
          severity: 'HIGH',
          type: 'mutated_field',
          summary: `NFR '${skel.id}' field '${field}' mutated`,
          location: `$.requirements[id=${skel.id}].${field}`,
          detail: `Skeleton: '${displayField(skel[field])}'\nEnrichment: '${displayField(echoed[field])}'`,
          recommendation: `Echo skeleton '${field}' verbatim.`,
        });
      }
    }
  }
  return findings;
}

export function validateEnrichmentEchoInvariance(
  params: ValidatorRuntimeParams,
): ValidatorFinding[] {
  const sub = getSubstrate(params);
  if (!sub) return [];
  const out = params.outputContent;
  if (!out) return [];

  const findings: ValidatorFinding[] = [];

  if (Array.isArray(sub.skeletonStories)) {
    findings.push(...checkStoryEchoes(sub.skeletonStories, out));
  }

  if (Array.isArray(sub.skeletonNfrs)) {
    findings.push(...checkNfrEchoes(sub.skeletonNfrs, out));
  }

  return findings;
}
