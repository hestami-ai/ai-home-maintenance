import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal, OpStreamDal, PrivilegeFrameDal, ExportDal, MatterKeysDal } from '../lib/database/index.js';
import { generateKey } from '../lib/encryption/cipher.js';
import { FirmKey, MatterKeyService } from '../lib/encryption/keyHierarchy.js';
import { MatterTrackStore, matterTrackPath } from '../lib/governedStream/matterTrackStore.js';
import { MatterTrackWriter } from '../lib/governedStream/matterTrackWriter.js';
import { MatterExporter } from '../lib/export/exporter.js';
import type { PrivilegeFrame } from '../lib/privilege/frame.js';

describe('matter exporter — discovery production filter', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;
  let opStream: OpStreamDal;
  let exportDal: ExportDal;
  let store: MatterTrackStore;
  let writer: MatterTrackWriter;
  let exporter: MatterExporter;
  let frameRef: { snapshotHash: string; version: number };
  const FIRM = 'f1', CLIENT = 'c1', MATTER = 'm1';
  const scope = { firmId: FIRM, clientId: CLIENT, matterId: MATTER };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-exp-'));
    db = openDirect(path.join(dir, 'platform.sqlite'));
    firmDal = new FirmDal(db);
    opStream = new OpStreamDal(db);
    exportDal = new ExportDal(db);
    const frameDal = new PrivilegeFrameDal(db);
    const firmKey = new FirmKey(generateKey());
    const keySvc = new MatterKeyService(new MatterKeysDal(db), firmKey);

    firmDal.insertFirm(FIRM, 'JC Law', 'MD');
    firmDal.insertClient(FIRM, CLIENT, 'C');
    firmDal.insertMatter({ firmId: FIRM, clientId: CLIENT, matterId: MATTER, matterName: 'M', practiceArea: 'family_law', primaryJurisdiction: 'MD', matterType: 'custody' });
    const keys = keySvc.provision(scope);
    const frame: PrivilegeFrame = { matterId: MATTER, attorneyClientPairs: [{ attorneyId: 'a1', clientId: CLIENT }] };
    frameRef = frameDal.saveSnapshot(scope, frame);

    store = new MatterTrackStore(matterTrackPath(dir, scope));
    writer = new MatterTrackWriter(scope, store, keys.contentKey, keys.mentalKey, opStream);
    exporter = new MatterExporter(exportDal, opStream, keys.contentKey, keys.mentalKey, store);

    // Seed events across classifications
    const types = [
      { type: 'fact_extracted', cls: 'work_product_factual' as const, payload: { fact: 'F1' } },
      { type: 'pruning_decision_recorded', cls: 'work_product_mental' as const, payload: { reason: 'mental' } },
      { type: 'client_message_received', cls: 'attorney_client' as const, payload: { msg: 'AC content' } },
      { type: 'client_document_inventoried', cls: 'client_confidential' as const, payload: { doc: 'CC content' } },
      { type: 'filed_pleading_recorded', cls: 'public_record' as const, payload: { filing: 'PR content' } },
    ];
    for (const t of types) {
      writer.write({
        scope, activeMatterContext: scope, eventType: t.type, payload: t.payload, clvScope: [],
        declaredClassification: t.cls, privilegeFrameRef: frameRef,
      });
    }
  });

  afterEach(() => {
    store.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('discovery_production_party EXCLUDES work_product_mental and attorney_client by default', () => {
    const pkg = exporter.exportMatter({ scope, purpose: 'discovery_production_party', requestedBy: 'attorney_of_record' });

    const includedCls = new Set(pkg.events.map((e) => e.classification));
    expect(includedCls.has('work_product_factual')).toBe(true);
    expect(includedCls.has('client_confidential')).toBe(true);
    expect(includedCls.has('public_record')).toBe(true);
    expect(includedCls.has('work_product_mental')).toBe(false);
    expect(includedCls.has('attorney_client')).toBe(false);

    // Privilege log entries for the excluded classifications
    const logCls = new Set(pkg.privilegeLog.map((l) => l.classification));
    expect(logCls.has('work_product_mental')).toBe(true);
    expect(logCls.has('attorney_client')).toBe(true);
    expect(pkg.privilegeLog).toHaveLength(2);

    // Mental + AC payloads must NOT appear in the package's events
    const allPayloadJson = JSON.stringify(pkg.events);
    expect(allPayloadJson).not.toContain('mental');
    expect(allPayloadJson).not.toContain('AC content');
  });

  it('client_file_transfer includes everything by default (entire-file rule)', () => {
    const pkg = exporter.exportMatter({ scope, purpose: 'client_file_transfer', requestedBy: 'attorney_of_record' });
    expect(pkg.events).toHaveLength(5);
    expect(pkg.privilegeLog).toHaveLength(0);
  });

  it('records the export in op-track only (no matter-track event)', () => {
    const beforeOp = opStream.countByType(FIRM, 'export_recorded');
    const beforeMatterEvents = store.listEvents().length;
    exporter.exportMatter({ scope, purpose: 'discovery_production_party', requestedBy: 'attorney_of_record' });
    expect(opStream.countByType(FIRM, 'export_recorded')).toBe(beforeOp + 1);
    // No new matter-track events from the export
    expect(store.listEvents().length).toBe(beforeMatterEvents);
  });

  it('persists an export_records row in the platform DB', () => {
    expect(exportDal.countForMatter(scope)).toBe(0);
    exporter.exportMatter({ scope, purpose: 'discovery_production_party', requestedBy: 'attorney_of_record' });
    expect(exportDal.countForMatter(scope)).toBe(1);
  });

  it('classificationOverride requires overrideBasis', () => {
    expect(() =>
      exporter.exportMatter({
        scope,
        purpose: 'discovery_production_party',
        requestedBy: 'attorney_of_record',
        classificationOverride: ['work_product_factual', 'work_product_mental', 'attorney_client', 'client_confidential', 'public_record'],
      }),
    ).toThrow(/overrideBasis/);
  });
});
