/**
 * DMR Context Helper — shared utility for invoking the Deep Memory Research
 * Agent and assembling its Context Packet into a phase-ready form.
 *
 * Each phase handler that needs cross-cutting context calls
 * `buildPhaseContextPacket()` near the top of execute(). The result includes:
 *
 *   - The full Context Packet (for record provenance + downstream queries)
 *   - A summary of `activeConstraints` ready to inline into LLM prompts
 *     under GOVERNING CONSTRAINTS
 *   - A `detail_file_path` for the prompt template (Channel 2 reference)
 *   - The set of derived_from record IDs to stamp on phase artifacts
 *
 * The helper is **graceful** — if DMR fails for any reason, it returns a
 * usable empty packet so the phase can continue. DMR failures are logged
 * but do not block the pipeline.
 */

import type { PhaseContext } from '../orchestratorEngine';
import type { ContextPacket, ScopeTier } from '../../agents/deepMemoryResearch';
import { getLogger } from '../../logging';
import { emit as aoddEmit } from '../../aodd';
import { renderHydratedPacket } from './dmrHydration';

export interface PhaseContextPacketOptions {
  /** Sub-phase ID for trace context and detail file naming */
  subPhaseId: string;
  /** Agent role making the request (e.g. 'requirements_agent') */
  requestingAgentRole: string;
  /** Natural-language query describing what context the agent needs */
  query: string;
  /** Scope tier — defaults to 'all_runs' for phases beyond 1 */
  scopeTier?: ScopeTier;
  /** Known relevant record IDs to seed the harvest */
  knownRelevantRecordIds?: string[];
  /** A short label for the detail file invocation_id (e.g. 'p2_1') */
  detailFileLabel?: string;
  /** Required output spec to include in the detail file's stdin section */
  requiredOutputSpec?: string;
}

export interface PhaseContextPacketResult {
  /** The Context Packet from DMR (or an empty stub on failure) */
  packet: ContextPacket | null;
  /** Active constraints rendered for inclusion in prompts */
  activeConstraintsText: string;
  /** Detail file path (or '(not available)' if write failed) */
  detailFilePath: string;
  /** Full markdown content of the detail file, suitable for inlining into
   *  LLM prompts. Phases 0-8 use direct LLM API calls and cannot read the
   *  detail file from disk; this lets the prompt template inline the
   *  substantive DMR context (material findings, completeness narrative,
   *  supersession chains, contradictions). Empty when DMR fails. */
  detailFileContent: string;
  /** Record IDs to include in derived_from */
  derivedFromRecordIds: string[];
}

/**
 * Invoke DMR for a phase, write the detail file, and return the assembled
 * context. Safe to call even if DMR / ContextBuilder fail — returns an
 * empty-but-usable result.
 */
export async function buildPhaseContextPacket(
  ctx: PhaseContext,
  options: PhaseContextPacketOptions,
): Promise<PhaseContextPacketResult> {
  const { workflowRun, engine } = ctx;

  const empty: PhaseContextPacketResult = {
    packet: null,
    activeConstraintsText: '(none)',
    detailFilePath: '(not available)',
    detailFileContent: '(no DMR detail content available)',
    derivedFromRecordIds: [],
  };

  let packet: ContextPacket | null = null;
  try {
    packet = await engine.deepMemoryResearch.research({
      requestingAgentRole: options.requestingAgentRole,
      scopeTier: options.scopeTier ?? 'all_runs',
      query: options.query.slice(0, 800),
      knownRelevantRecordIds: options.knownRelevantRecordIds ?? [],
      workflowRunId: workflowRun.id,
      phaseId: ctx.workflowRun.current_phase_id ?? '',
      subPhaseId: options.subPhaseId,
    });
  } catch (err) {
    getLogger().warn('phase_dmr', 'DMR invocation failed — proceeding without packet', {
      subPhaseId: options.subPhaseId,
      error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }

  if (!packet) return empty;

  const activeConstraintsText = packet.activeConstraints.length > 0
    ? packet.activeConstraints
        .map((c, i) => `${i + 1}. ${c.statement} (Authority ${c.authorityLevel}, source: ${c.sourceRecordIds[0] ?? 'unknown'})`)
        .join('\n')
    : '(none)';

  // Write the detail file via ContextBuilder for audit + Phase 9 readiness.
  // Also capture the markdown content so phases 0-8 (direct LLM API calls,
  // no filesystem access) can inline it into their prompts via the
  // `detail_file_content` template variable.
  let detailFile: { path: string; content: string } | null = null;
  try {
    const invocationId = `${options.detailFileLabel ?? options.subPhaseId.replace(/\./g, '_')}-${workflowRun.id.slice(0, 8)}`;
    const payload = engine.contextBuilder.buildContextPayload(
      options.subPhaseId,
      invocationId,
      {
        governingConstraints: activeConstraintsText,
        requiredOutputSpec: options.requiredOutputSpec ?? '',
        summaryContext: `DMR completeness: ${packet.completenessStatus}. ${packet.completenessNarrative}`,
        detailFileReference: '',
      },
      {
        // Curated, resolved DMR reference (record-id references hydrated into
        // actual content excerpts) — replaces the old raw JSON dump. The raw
        // packet is still recoverable behind JANUMICODE_DMR_RAW_DETAIL=1.
        hydratedPacket: renderHydratedPacket(packet, (id) => {
          const rec = engine.writer.getRecord(id);
          return rec ? { record_type: rec.record_type, content: rec.content } : null;
        }),
        ...(process.env.JANUMICODE_DMR_RAW_DETAIL === '1'
          ? { contextPacket: JSON.stringify(packet, null, 2) }
          : {}),
        narrativeMemories: [],
        decisionTraces: '',
        technicalSpecs: [],
        complianceContext: '',
        unstickingResolutions: '',
      },
      workflowRun.id,
    );
    if (payload.detailFile) {
      detailFile = { path: payload.detailFile.path, content: payload.detailFile.content };
    }
  } catch (err) {
    getLogger().debug('phase_dmr', 'Detail file write failed — using sentinel', {
      subPhaseId: options.subPhaseId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Derived-from set: the active-constraint sources plus the top material
  // findings, capped to keep record bloat manageable.
  const derivedFromRecordIds = Array.from(new Set([
    ...packet.activeConstraints.flatMap(c => c.sourceRecordIds),
    ...packet.materialFindings.slice(0, 10).flatMap(f => f.sourceRecordIds),
  ]));

  // AODD: context-assembly outcome. The input_record_ids list shows
  // exactly which upstream records the assembler pulled — would have
  // caught "Phase 8.5 never read user_stories from Phase 2" on ts-18.
  aoddEmit('context.assembled', { input_record_ids: derivedFromRecordIds });

  return {
    packet,
    activeConstraintsText,
    detailFilePath: detailFile?.path ?? '(not available)',
    detailFileContent: detailFile?.content ?? '(no DMR detail content available)',
    derivedFromRecordIds,
  };
}
