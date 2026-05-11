/**
 * Prompt assembler.
 *
 * Per docs/janumilegal_multi_matter_isolation_addendum.md §5.2:
 *   "LLM prompt construction is performed by a prompt assembler that reads
 *    only from the envelope. No global retrieval, no firm-wide RAG, no
 *    cross-matter examples."
 *
 * The assembler refuses to access any data source not declared in the
 * AgentInvocationScope. This is the architectural floor for cross-matter
 * isolation at the prompt-construction layer.
 */

import type { CLV } from '../clv/types.js';
import type { AgentInvocationScope, SourceRef, ArtifactRef, MMPRef } from '../scope/agentInvocationScope.js';

export interface AssembledPrompt {
  readonly system: string;
  readonly user: string;
  /** The scope envelope used; included for audit / op-track recording. */
  readonly envelopeRef: { lensId: string; lensVersion: string; stateId: string };
}

export interface AssemblyContext {
  readonly templateBody: string;
  /** Resolver for source content. The prompt assembler will only call the
   *  resolver for sources that appear in the envelope's authorizedSources. */
  readonly resolveSource?: (ref: SourceRef) => string;
  /** Resolver for prior artifact content. */
  readonly resolveArtifact?: (ref: ArtifactRef) => string;
  /** Resolver for MMP cards. */
  readonly resolveMMP?: (ref: MMPRef) => string;
}

export class PromptAssemblyError extends Error {
  constructor(
    message: string,
    readonly code: 'SOURCE_NOT_AUTHORIZED' | 'ARTIFACT_NOT_AUTHORIZED' | 'MMP_NOT_AUTHORIZED' | 'CLV_TERM_UNKNOWN' | 'FORBIDDEN_SCOPE_REFERENCED',
  ) {
    super(message);
    this.name = 'PromptAssemblyError';
  }
}

export interface AssemblerOptions {
  readonly clv: CLV;
}

export class PromptAssembler {
  constructor(private readonly options: AssemblerOptions) {}

  /**
   * Assemble a prompt from the envelope and template body.
   *
   * The assembler:
   *   - resolves {{clv:<termId>:<field>}} placeholders against the CLV.
   *   - resolves {{source:<sourceId>}} only if the source is in the envelope.
   *   - resolves {{artifact:<artifactId>}} only if the artifact is in the envelope.
   *   - throws if any reference is to a forbidden or unauthorized resource.
   */
  assemble(envelope: AgentInvocationScope, ctx: AssemblyContext): AssembledPrompt {
    const authorizedSourceIds = new Set(envelope.authorizedSources.map((s) => s.sourceId));
    const authorizedArtifactIds = new Set(envelope.authorizedPriorArtifacts.map((a) => a.artifactId));
    const authorizedMMPIds = new Set(envelope.authorizedMMP.map((m) => m.mmpId));

    const body = this.expandPlaceholders(ctx.templateBody, {
      clvLookup: (termId, field) => {
        const entry = this.options.clv.get(termId);
        if (!entry) throw new PromptAssemblyError(`CLV term ${termId} not found`, 'CLV_TERM_UNKNOWN');
        switch (field) {
          case 'name':
            return entry.canonicalName;
          case 'definition':
            return entry.oneLineDefinition;
          case 'long':
            return entry.longDefinition;
          default:
            return entry.canonicalName;
        }
      },
      sourceLookup: (sourceId) => {
        if (!authorizedSourceIds.has(sourceId)) {
          throw new PromptAssemblyError(
            `source ${sourceId} not authorized for this invocation`,
            'SOURCE_NOT_AUTHORIZED',
          );
        }
        const ref = envelope.authorizedSources.find((s) => s.sourceId === sourceId)!;
        return ctx.resolveSource ? ctx.resolveSource(ref) : `[source ${sourceId}]`;
      },
      artifactLookup: (artifactId) => {
        if (!authorizedArtifactIds.has(artifactId)) {
          throw new PromptAssemblyError(
            `artifact ${artifactId} not authorized for this invocation`,
            'ARTIFACT_NOT_AUTHORIZED',
          );
        }
        const ref = envelope.authorizedPriorArtifacts.find((a) => a.artifactId === artifactId)!;
        return ctx.resolveArtifact ? ctx.resolveArtifact(ref) : `[artifact ${artifactId}]`;
      },
      mmpLookup: (mmpId) => {
        if (!authorizedMMPIds.has(mmpId)) {
          throw new PromptAssemblyError(`MMP ${mmpId} not authorized for this invocation`, 'MMP_NOT_AUTHORIZED');
        }
        const ref = envelope.authorizedMMP.find((m) => m.mmpId === mmpId)!;
        return ctx.resolveMMP ? ctx.resolveMMP(ref) : `[mmp ${mmpId}]`;
      },
    });

    const system = `You are a bounded legal-workflow agent operating in lens '${envelope.lensId}@${envelope.lensVersion}', state '${envelope.stateId}'. You may only act within the scope provided. Do not attempt to retrieve or reference any data outside this envelope.`;

    return {
      system,
      user: body,
      envelopeRef: {
        lensId: envelope.lensId,
        lensVersion: envelope.lensVersion,
        stateId: envelope.stateId,
      },
    };
  }

  private expandPlaceholders(
    body: string,
    handlers: {
      clvLookup: (termId: string, field: string) => string;
      sourceLookup: (id: string) => string;
      artifactLookup: (id: string) => string;
      mmpLookup: (id: string) => string;
    },
  ): string {
    // {{clv:<termId>[:<field>]}}
    let out = body.replace(/\{\{\s*clv:([a-z0-9._-]+)(?::([a-z_]+))?\s*\}\}/gi, (_m, termId, field) =>
      handlers.clvLookup(String(termId), String(field ?? 'name')),
    );
    // {{source:<sourceId>}}
    out = out.replace(/\{\{\s*source:([a-zA-Z0-9._-]+)\s*\}\}/g, (_m, id) => handlers.sourceLookup(String(id)));
    // {{artifact:<artifactId>}}
    out = out.replace(/\{\{\s*artifact:([a-zA-Z0-9._-]+)\s*\}\}/g, (_m, id) => handlers.artifactLookup(String(id)));
    // {{mmp:<mmpId>}}
    out = out.replace(/\{\{\s*mmp:([a-zA-Z0-9._-]+)\s*\}\}/g, (_m, id) => handlers.mmpLookup(String(id)));
    return out;
  }
}
