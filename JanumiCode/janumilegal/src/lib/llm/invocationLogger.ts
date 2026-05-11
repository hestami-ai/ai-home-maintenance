/**
 * Invocation logger — writes prompt-assembled and completion-received
 * events to the matter-track Governed Stream.
 *
 * Per Wave 10:
 *   - prompt_assembled       → work_product_factual (the system+user prompt the agent actually sent)
 *   - completion_received    → work_product_factual (the model's response)
 *
 * If a template declares its outputs as opinion content (mental impressions,
 * pruning rationales, attorney commentary), the caller passes
 * `classification: 'work_product_mental'` to override.
 *
 * Op-track receives only metadata (latency, token counts, model id).
 */

import { randomUUID } from 'node:crypto';
import type { MatterTrackWriter } from '../governedStream/matterTrackWriter.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { AgentInvocationScope } from '../scope/agentInvocationScope.js';
import type { MatterTrackClassification } from '../governedStream/classifications.js';
import type { LLMResponse } from './provider.js';

export interface PromptLogEntry {
  readonly envelope: AgentInvocationScope;
  readonly agentId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly systemText: string;
  readonly userText: string;
  readonly systemBytes: number;
  readonly userBytes: number;
  /** Override classification when the template emits opinion content. */
  readonly classification?: MatterTrackClassification;
}

export interface CompletionLogEntry {
  readonly envelope: AgentInvocationScope;
  readonly agentId: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly completionText: string;
  readonly stopReason?: string;
  readonly usage?: LLMResponse['usage'];
  readonly classification?: MatterTrackClassification;
}

export class InvocationLogger {
  constructor(
    private readonly writer: MatterTrackWriter,
    private readonly opStream: OpStreamDal,
  ) {}

  logPromptAssembled(entry: PromptLogEntry): void {
    const correlationId = randomUUID();
    this.writer.write({
      scope: { firmId: entry.envelope.firmId, clientId: entry.envelope.clientId, matterId: entry.envelope.matterId },
      activeMatterContext: { firmId: entry.envelope.firmId, clientId: entry.envelope.clientId, matterId: entry.envelope.matterId },
      lensId: entry.envelope.lensId,
      lensVersion: entry.envelope.lensVersion,
      stateId: entry.envelope.stateId,
      agentId: entry.agentId,
      correlationId,
      eventType: 'prompt_assembled',
      payload: {
        templateId: entry.templateId,
        templateVersion: entry.templateVersion,
        system: entry.systemText,
        user: entry.userText,
      },
      clvScope: ['clv.core.work_product.v1'],
      declaredClassification: entry.classification ?? 'work_product_factual',
      privilegeFrameRef: entry.envelope.privilegeFrame,
    });
    this.opStream.write({
      eventType: 'agent_invoked',
      firmId: entry.envelope.firmId,
      payload: {
        kind: 'prompt_assembled',
        agentId: entry.agentId,
        templateId: entry.templateId,
        systemBytes: entry.systemBytes,
        userBytes: entry.userBytes,
        correlationId,
      },
    });
  }

  logCompletionReceived(entry: CompletionLogEntry): void {
    const correlationId = randomUUID();
    this.writer.write({
      scope: { firmId: entry.envelope.firmId, clientId: entry.envelope.clientId, matterId: entry.envelope.matterId },
      activeMatterContext: { firmId: entry.envelope.firmId, clientId: entry.envelope.clientId, matterId: entry.envelope.matterId },
      lensId: entry.envelope.lensId,
      lensVersion: entry.envelope.lensVersion,
      stateId: entry.envelope.stateId,
      agentId: entry.agentId,
      correlationId,
      eventType: 'completion_received',
      payload: {
        templateId: entry.templateId,
        templateVersion: entry.templateVersion,
        completion: entry.completionText,
        stopReason: entry.stopReason ?? null,
      },
      clvScope: ['clv.core.work_product.v1'],
      declaredClassification: entry.classification ?? 'work_product_factual',
      privilegeFrameRef: entry.envelope.privilegeFrame,
    });
    this.opStream.write({
      eventType: 'agent_completed',
      firmId: entry.envelope.firmId,
      payload: {
        kind: 'completion_received',
        agentId: entry.agentId,
        templateId: entry.templateId,
        completionBytes: Buffer.byteLength(entry.completionText, 'utf8'),
        stopReason: entry.stopReason ?? null,
        inputTokens: entry.usage?.inputTokens ?? null,
        outputTokens: entry.usage?.outputTokens ?? null,
        correlationId,
      },
    });
  }
}
