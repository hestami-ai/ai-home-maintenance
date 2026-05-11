/**
 * Reviewer-agreement service tests (Wave 12).
 *
 * Covers:
 *   - Annotation invariants (rationale required for disagreements;
 *     missed-issue requires expectedValidatorId).
 *   - Annotation persistence at work_product_mental classification.
 *   - Aggregate metrics: precision, recall, severity adjustments.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openDirect, ClvDal, FirmDal, OpStreamDal, PrivilegeFrameDal, MatterKeysDal,
} from '../lib/database/index.js';
import { loadCLVv1 } from '../lib/clv/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { MatterTrackReader } from '../lib/governedStream/matterTrackReader.js';
import { ReviewerAgreementService } from '../lib/reviewerAgreement/service.js';
import type { FindingAnnotation } from '../lib/reviewerAgreement/types.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

describe('ReviewerAgreementService', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let store: MatterTrackStore;
  let writer: MatterTrackWriter;
  let svc: ReviewerAgreementService;
  let frameRef: { snapshotHash: string; version: number };
  let contentKey: Buffer;
  let mentalKey: Buffer;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-ra-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    loadCLVv1(new ClvDal(db));
    const firmDal = new FirmDal(db);
    const opStream = new OpStreamDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);
    firmDal.insertFirm(FIRM, 'X', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    contentKey = keys.contentKey;
    mentalKey = keys.mentalKey;
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [] };
    frameRef = frameDal.saveSnapshot(scope, frame);
    store = new MatterTrackStore(matterTrackPath(dir, scope));
    writer = new MatterTrackWriter(scope, store, contentKey, mentalKey, opStream);
    svc = new ReviewerAgreementService(writer);
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects disagreement annotation without rationale', () => {
    expect(() =>
      svc.recordAnnotation({
        scope,
        findingId: 'f1',
        validatorId: 'grounding_validator',
        stateId: 'FactExtraction',
        annotationType: 'disagree_finding_incorrect',
        annotatorAttorneyId: 'a1',
        annotatorBarNumber: '0001',
        privilegeFrameRef: frameRef,
      }),
    ).toThrow(/DISAGREEMENT_RATIONALE_REQUIRED|non-empty rationale/);
  });

  it('rejects missed-issue annotation without expectedValidatorId', () => {
    expect(() =>
      svc.recordAnnotation({
        scope,
        findingId: 'missed_1',
        validatorId: 'unknown',
        stateId: 'IssueBloom',
        annotationType: 'attorney_flagged_missed_issue',
        annotatorAttorneyId: 'a1',
        annotatorBarNumber: '0001',
        privilegeFrameRef: frameRef,
        missedIssue: true,
      }),
    ).toThrow(/expectedValidatorId/);
  });

  it('records annotation as work_product_mental', () => {
    svc.recordAnnotation({
      scope,
      findingId: 'f1',
      validatorId: 'grounding_validator',
      stateId: 'FactExtraction',
      annotationType: 'agree_finding_correct',
      annotatorAttorneyId: 'a1',
      annotatorBarNumber: '0001',
      privilegeFrameRef: frameRef,
    });
    const reader = new MatterTrackReader(store, contentKey, mentalKey);
    const events = reader.read({ authorizedClassifications: ['work_product_mental'] });
    const annotation = events.find((e) => e.eventType === 'reasoning_review_annotation');
    expect(annotation).toBeDefined();
    expect(annotation!.classification).toBe('work_product_mental');
    expect(annotation!.redacted).toBe(false);
  });

  it('computes precision, recall, and severity-adjustment metrics', () => {
    const annotations: FindingAnnotation[] = [
      // grounding_validator: 3 agrees, 1 disagree, 1 missed → P=3/4=0.75, R=3/4=0.75
      { annotationId: '1', findingId: 'f1', validatorId: 'grounding_validator', stateId: 'X', annotationType: 'agree_finding_correct', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't' },
      { annotationId: '2', findingId: 'f2', validatorId: 'grounding_validator', stateId: 'X', annotationType: 'agree_finding_correct', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't' },
      { annotationId: '3', findingId: 'f3', validatorId: 'grounding_validator', stateId: 'X', annotationType: 'agree_finding_correct', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't' },
      { annotationId: '4', findingId: 'f4', validatorId: 'grounding_validator', stateId: 'X', annotationType: 'disagree_finding_incorrect', rationale: 'wrong', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't' },
      { annotationId: '5', findingId: 'm1', validatorId: 'unknown', stateId: 'X', annotationType: 'attorney_flagged_missed_issue', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't', missedIssue: true, expectedValidatorId: 'grounding_validator' },
      // authority_status_tiering: 2 disagree_severity_should_be_high
      { annotationId: '6', findingId: 'f6', validatorId: 'authority_status_tiering', stateId: 'X', annotationType: 'disagree_severity_should_be_high', rationale: 'underrated', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't' },
      { annotationId: '7', findingId: 'f7', validatorId: 'authority_status_tiering', stateId: 'X', annotationType: 'disagree_severity_should_be_high', rationale: 'underrated', annotatorAttorneyId: 'a1', annotatorBarNumber: 'b', timestamp: 't' },
    ];
    const m = svc.computeMetrics(annotations);
    const grounding = m.perValidator.find((v) => v.validatorId === 'grounding_validator')!;
    expect(grounding.agreeCount).toBe(3);
    expect(grounding.disagreeCount).toBe(1);
    expect(grounding.missedCount).toBe(1);
    expect(grounding.precision).toBeCloseTo(0.75, 5);
    expect(grounding.recall).toBeCloseTo(0.75, 5);

    const authority = m.perValidator.find((v) => v.validatorId === 'authority_status_tiering')!;
    expect(authority.severityAdjustments.toHigh).toBe(2);
  });

  it('returns zero metrics for validator with no annotations', () => {
    const m = svc.computeMetrics([]);
    expect(m.perValidator).toEqual([]);
  });
});
