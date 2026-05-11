/**
 * Matter-track writer.
 *
 * Per docs/design/governed_stream_privilege.md §6 and §11:
 *   - Classification mandatory at write time.
 *   - Scope tuple (firm/client/matter) mandatory.
 *   - active_matter_context recorded; mismatch is an alarm.
 *   - Privilege Frame snapshot ref recorded.
 *   - CLV scope recorded.
 *   - Cross-matter event prohibition (one matterId per event).
 *   - Mental sub-segment uses a separate per-matter key.
 *   - Hash chain per (matter, classification).
 */

import { randomUUID, createHash } from 'node:crypto';
import * as os from 'node:os';
import type { Scope } from '../database/types.js';
import type { OpStreamDal } from '../database/opStreamDal.js';
import type { MatterTrackStore, MatterTrackEventRow } from './matterTrackStore.js';
import { computePayloadHash } from './hashChain.js';
import { encrypt, type EncryptedEnvelope } from '../encryption/cipher.js';
import { PrivilegeClassifier, type ClassificationInput } from './classifier.js';
import { isMatterTrackClassification, usesMentalKey, type MatterTrackClassification } from './classifications.js';
import type { PrivilegeFrameSnapshotRef } from '../privilege/frame.js';

export class MatterTrackWriteError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'MatterTrackWriteError';
  }
}

export interface MatterTrackWriteRequest {
  readonly scope: Scope;
  readonly activeMatterContext: Scope | null;
  readonly userId?: string;
  readonly lensId?: string;
  readonly lensVersion?: string;
  readonly stateId?: string;
  readonly agentId?: string;
  readonly agentRunId?: string;
  readonly correlationId?: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly clvScope: readonly string[];
  readonly classificationInput?: Omit<ClassificationInput, 'eventType' | 'declaredClassification'>;
  readonly declaredClassification?: MatterTrackClassification;
  readonly privilegeFrameRef: PrivilegeFrameSnapshotRef;
}

export interface MatterTrackWriteResult {
  readonly eventId: string;
  readonly classification: MatterTrackClassification;
  readonly payloadHash: string;
}

/**
 * Wave 3 matter-track writer. Each writer is bound to a single matter's
 * `MatterTrackStore` and the keys for that matter. Writers do not share
 * state across matters.
 */
export class MatterTrackWriter {
  private readonly classifier = new PrivilegeClassifier();
  private readonly writerNode: string;

  constructor(
    private readonly scope: Scope,
    private readonly store: MatterTrackStore,
    private readonly contentKey: Buffer,
    private readonly mentalKey: Buffer,
    private readonly opStream: OpStreamDal,
  ) {
    this.writerNode = os.hostname();
  }

  write(req: MatterTrackWriteRequest): MatterTrackWriteResult {
    if (
      req.scope.firmId !== this.scope.firmId ||
      req.scope.clientId !== this.scope.clientId ||
      req.scope.matterId !== this.scope.matterId
    ) {
      throw new MatterTrackWriteError(
        `scope mismatch: writer bound to ${formatScope(this.scope)}, write requested for ${formatScope(req.scope)}`,
        'SCOPE_MISMATCH',
      );
    }

    // Cross-matter event prohibition (privilege design §6.3): a single event
    // may not reference more than one matter. We enforce this by refusing to
    // write to one matter's track when the active context is a different matter.
    if (
      req.activeMatterContext &&
      (req.activeMatterContext.firmId !== this.scope.firmId ||
        req.activeMatterContext.clientId !== this.scope.clientId ||
        req.activeMatterContext.matterId !== this.scope.matterId)
    ) {
      // Emit op-track alarm AND refuse the write.
      this.opStream.write({
        eventType: 'matter_context_switched',
        firmId: this.scope.firmId,
        clientId: this.scope.clientId,
        matterId: this.scope.matterId,
        payload: {
          alarm: 'active_matter_context_mismatch',
          targetMatterScopeHash: hashScope(this.scope),
          activeMatterContextScopeHash: hashScope(req.activeMatterContext),
        },
      });
      throw new MatterTrackWriteError(
        'active matter context does not match write target — possible mistaken-matter action',
        'ACTIVE_MATTER_CONTEXT_MISMATCH',
      );
    }

    // Classify
    const classified = this.classifier.classify({
      eventType: req.eventType,
      declaredClassification: req.declaredClassification,
      ...(req.classificationInput ?? {}),
    });
    if (!isMatterTrackClassification(classified.classification)) {
      throw new MatterTrackWriteError(
        `classifier produced ${classified.classification} which is not matter-track`,
        'CLASSIFICATION_NOT_MATTER_TRACK',
      );
    }

    const cls = classified.classification;
    const key = usesMentalKey(cls) ? this.mentalKey : this.contentKey;

    // Encrypt payload
    const plaintext = Buffer.from(JSON.stringify(req.payload), 'utf8');
    const envelope: EncryptedEnvelope = encrypt(key, plaintext);

    // Hash chain
    const prev = this.store.getChainHead(cls);
    const payloadHash = computePayloadHash(prev, envelope.bytes);

    const eventId = randomUUID();
    const row: MatterTrackEventRow = {
      eventId,
      correlationId: req.correlationId ?? null,
      userId: req.userId ?? null,
      activeMatterContext: req.activeMatterContext ? formatScope(req.activeMatterContext) : formatScope(this.scope),
      lensId: req.lensId ?? null,
      lensVersion: req.lensVersion ?? null,
      stateId: req.stateId ?? null,
      agentId: req.agentId ?? null,
      agentRunId: req.agentRunId ?? null,
      classification: cls,
      privilegeFrameRef: req.privilegeFrameRef.snapshotHash,
      clvScopeJson: JSON.stringify(req.clvScope),
      eventType: req.eventType,
      payloadEnvelope: envelope.bytes,
      payloadHash,
      prevEventHash: prev,
      writtenAt: new Date().toISOString(),
      writerNode: this.writerNode,
    };
    this.store.insertEvent(row);
    return { eventId, classification: cls, payloadHash };
  }
}

function formatScope(s: Scope): string {
  return `${s.firmId}/${s.clientId}/${s.matterId}`;
}

function hashScope(s: Scope): string {
  // Stable but non-identifying op-track-friendly representation
  // (sha256 of the scope tuple, truncated). Suitable for op-metadata only.
  return createHash('sha256').update(formatScope(s)).digest('hex').slice(0, 16);
}
