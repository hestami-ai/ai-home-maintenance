import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { DependencyClosureResolver } from '../../../lib/orchestrator/dependencyClosureResolver';

let idCounter = 0;
function testId(): string { return `dcr-${++idCounter}`; }

describe('DependencyClosureResolver', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let resolver: DependencyClosureResolver;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    resolver = new DependencyClosureResolver(db, 50);

    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  function writeArtifact(id?: string): string {
    const record = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'abc',
      content: {},
    });
    return record.id;
  }

  function addEdge(sourceId: string, targetId: string, edgeType: string = 'derives_from'): void {
    db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES (?, ?, ?, ?, 'test', '2026-01-01T00:00:00Z', 5, 'system_asserted')
    `).run(testId(), sourceId, targetId, edgeType);
  }

  it('computes simple linear closure', () => {
    // A → B → C (C derives from B, B derives from A)
    const a = writeArtifact();
    const b = writeArtifact();
    const c = writeArtifact();
    addEdge(b, a); // B derives from A
    addEdge(c, b); // C derives from B

    const closure = resolver.computeClosure(a, 'run-1');

    // Rollback A should include B and C (everything that derives from A)
    expect(closure.closureIds).toContain(a);
    expect(closure.closureIds).toContain(b);
    expect(closure.closureIds).toContain(c);
    expect(closure.closureSize).toBe(3);
  });

  it('computes branching closure', () => {
    // A → B, A → C (both B and C derive from A)
    const a = writeArtifact();
    const b = writeArtifact();
    const c = writeArtifact();
    addEdge(b, a);
    addEdge(c, a);

    const closure = resolver.computeClosure(a, 'run-1');

    expect(closure.closureIds).toContain(a);
    expect(closure.closureIds).toContain(b);
    expect(closure.closureIds).toContain(c);
    expect(closure.closureSize).toBe(3);
  });

  it('detects cycles', () => {
    const a = writeArtifact();
    const b = writeArtifact();
    addEdge(b, a); // B derives from A
    addEdge(a, b); // A derives from B (cycle!)

    const closure = resolver.computeClosure(a, 'run-1');

    expect(closure.cycleDetected).toBe(true);
  });

  it('stops at cross-run boundaries', () => {
    // Create artifact in a different run
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-2', 'ws-1', 'abc', '2026-01-02T00:00:00Z', 'initiated')
    `).run();

    const a = writeArtifact(); // run-1

    // Create artifact in run-2
    const priorRecord = writer.writeRecord({
      record_type: 'artifact_produced',
      schema_version: '1.0',
      workflow_run_id: 'run-2',
      source_workflow_run_id: 'run-2',
      janumicode_version_sha: 'abc',
      content: {},
    });

    addEdge(priorRecord.id, a); // prior-run artifact derives from A

    const closure = resolver.computeClosure(a, 'run-1');

    // Prior-run artifact should be referenced but NOT in the closure
    expect(closure.closureIds).toContain(a);
    expect(closure.closureIds).not.toContain(priorRecord.id);
    expect(closure.crossRunReferences).toContain(priorRecord.id);
  });

  it('detects closure size limit exceedance', () => {
    const smallResolver = new DependencyClosureResolver(db, 2);
    const a = writeArtifact();
    const b = writeArtifact();
    const c = writeArtifact();
    addEdge(b, a);
    addEdge(c, a);

    const closure = smallResolver.computeClosure(a, 'run-1');

    expect(closure.exceedsLimit).toBe(true);
    expect(closure.closureSize).toBe(3);
  });

  it('returns single-element closure when no dependencies', () => {
    const a = writeArtifact();

    const closure = resolver.computeClosure(a, 'run-1');

    expect(closure.closureIds).toEqual([a]);
    expect(closure.closureSize).toBe(1);
    expect(closure.cycleDetected).toBe(false);
    expect(closure.exceedsLimit).toBe(false);
  });

  it('executeRollback marks artifacts as non-current', () => {
    const a = writeArtifact();
    const b = writeArtifact();
    addEdge(b, a);

    const closure = resolver.computeClosure(a, 'run-1');
    resolver.executeRollback(closure, 'rollback-1', 'run-1');

    // Check artifacts are marked non-current
    const aRecord = writer.getRecord(a);
    expect(aRecord!.is_current_version).toBe(false);
    expect(aRecord!.superseded_by_id).toBe('rollback-1');

    const bRecord = writer.getRecord(b);
    expect(bRecord!.is_current_version).toBe(false);
  });

  describe('phase-gate invalidation on rollback', () => {
    // Regression: before the phase_gates producer fix, nothing ever
    // INSERTed into phase_gates, so findAffectedPhaseGates always returned
    // an empty set and executeRollback silently never marked any gate
    // invalidated_by_rollback_at. The DecisionRouter now writes the row
    // with phase_gates.id == the phase_gate_approved record id so the
    // `validates` memory_edge (which ingestion keys off that same id)
    // lines up.

    // Mirror the DecisionRouter's producer invariant: phase_gates.id ==
    // the phase_gate_approved governed_stream record's id. The validates
    // memory_edge has an FK into governed_stream on source_record_id, so
    // the test must write a real approved record, not a synthetic id.
    function makeApprovedGate(phaseId: string = '1'): string {
      const approved = writer.writeRecord({
        record_type: 'phase_gate_approved',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        phase_id: phaseId,
        janumicode_version_sha: 'abc',
        content: {},
      });
      db.prepare(`
        INSERT INTO phase_gates
          (id, workflow_run_id, phase_id, completed_at, human_approved, approval_record_id)
        VALUES (?, 'run-1', ?, '2026-01-01T00:00:00Z', 1, ?)
      `).run(approved.id, phaseId, approved.id);
      return approved.id;
    }

    it('returns gates whose validates edge targets any closure artifact', () => {
      // Phase-gate approval validates artifact A. Roll back A: the gate
      // that certified A must surface as affected.
      const a = writeArtifact();
      const gateId = makeApprovedGate();
      addEdge(gateId, a, 'validates');

      const closure = resolver.computeClosure(a, 'run-1');
      expect(closure.affectedPhaseGates).toContain(gateId);
    });

    it('does not return gates whose validates edge targets something outside the closure', () => {
      // Gate certifies B, closure is rooted at A. Gate should be untouched.
      const a = writeArtifact();
      const b = writeArtifact();
      const gateId = makeApprovedGate();
      addEdge(gateId, b, 'validates');

      const closure = resolver.computeClosure(a, 'run-1');
      expect(closure.affectedPhaseGates).not.toContain(gateId);
    });

    it('executeRollback stamps invalidated_by_rollback_at on affected gates', () => {
      const a = writeArtifact();
      const gateId = makeApprovedGate();
      addEdge(gateId, a, 'validates');

      const closure = resolver.computeClosure(a, 'run-1');
      resolver.executeRollback(closure, 'rollback-1', 'run-1');

      const row = db
        .prepare('SELECT invalidated_by_rollback_at FROM phase_gates WHERE id = ?')
        .get(gateId) as { invalidated_by_rollback_at: string | null } | undefined;
      expect(row?.invalidated_by_rollback_at).toBeTruthy();
    });

    it('leaves unaffected gates untouched after rollback', () => {
      const a = writeArtifact();
      const b = writeArtifact();
      const gateA = makeApprovedGate('1');
      const gateB = makeApprovedGate('2');
      addEdge(gateA, a, 'validates');
      addEdge(gateB, b, 'validates');

      const closure = resolver.computeClosure(a, 'run-1');
      resolver.executeRollback(closure, 'rollback-1', 'run-1');

      const rowB = db
        .prepare('SELECT invalidated_by_rollback_at FROM phase_gates WHERE id = ?')
        .get(gateB) as { invalidated_by_rollback_at: string | null } | undefined;
      expect(rowB?.invalidated_by_rollback_at).toBeNull();
    });
  });
});
