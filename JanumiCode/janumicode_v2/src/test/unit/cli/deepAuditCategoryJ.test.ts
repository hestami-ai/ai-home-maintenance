/**
 * Characterization test for deep-audit category J (persistence integrity).
 * Pins the CURRENT observable behavior of categoryJ_persistence so the S3776
 * decomposition (extraction of buildStepByOutputRecordId / buildStepsBySubPhase
 * / stepTopLevelKeys / findFallbackCandidate / findPersistenceCandidate /
 * extractTraceOutput / detectRenames / droppedKeysFinding / renamedKeysFinding /
 * surplusKeysFinding / arraySizeFindings / persistenceFindingsForArtifact) is
 * verified behavior-preserving.
 *
 * Behavior captured (from the original inline implementation):
 *   - only `artifact_produced` records with a truthy sub_phase_id are inspected
 *   - producer step match: PRIMARY = a step whose output_record_id equals the
 *     artifact's record_id; FALLBACK = the LAST normalized/json_parsed step in
 *     the same sub-phase at or before produced_at whose top-level keys intersect
 *     the artifact's (excluding kind + schemaVersion). A json_parsed step with
 *     no `parsed_top_level_keys` metadata contributes NO keys, so it can never
 *     be selected as a fallback candidate.
 *   - trace output = payload.output (normalized) or payload.parsed (otherwise);
 *     a non-object trace output is skipped
 *   - dropped/surplus exclude kind + schemaVersion on BOTH sides
 *   - a dropped trace key whose case-variant appears in dbKeys is a RENAME (INFO)
 *     not a drop; surplus is NOT deduped against renames, so a pure rename emits
 *     BOTH a renamed-INFO and a surplus-INFO
 *   - per artifact the emission order is: dropped(BLOCK), renamed(INFO),
 *     array-size(BLOCK when trace>db else WARN, in traceKeys order), surplus(INFO)
 *   - `ref` is `step:${step_id.slice(0,8)}` (array-size adds ` field:${k}`)
 */

import { describe, it, expect } from 'vitest';
import {
  categoryJ_persistence,
  type DbArtifact,
  type TransformStep,
} from '../../../cli/deep-audit';

function artifact(over: Partial<DbArtifact> = {}): DbArtifact {
  return {
    record_id: 'A1',
    record_type: 'artifact_produced',
    phase_id: '3',
    sub_phase_id: '3.1',
    produced_at: '2026-01-01T00:00:10Z',
    kind: undefined,
    content: {},
    ...over,
  };
}

function step(over: Partial<TransformStep> = {}): TransformStep {
  return {
    step_id: 'stepid00-tail',
    ts: '2026-01-01T00:00:05Z',
    step_type: 'normalized',
    sub_phase_id: '3.1',
    parent_step_id: null,
    input_record_ids: [],
    ...over,
  };
}

describe('categoryJ_persistence (characterization)', () => {
  it('flags a dropped key via primary output_record_id match (BLOCK)', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'A1', content: { foo: 1 } })],
      [step({ output_record_id: 'A1', payload: { output: { foo: 1, bar: 2 } } })],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'A1',
        ref: 'step:stepid00',
        message: 'Keys in trace-step output dropped at persist boundary: bar',
      },
    ]);
  });

  it('emits BOTH a renamed-INFO and a surplus-INFO for a pure case rename', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'B1', content: { userStories: [1] } })],
      [step({ output_record_id: 'B1', payload: { output: { user_stories: [1] } } })],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'INFO',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'B1',
        ref: 'step:stepid00',
        message: 'Normalizer renamed 1 key(s): user_stories→userStories',
      },
      {
        category: 'J',
        severity: 'INFO',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'B1',
        ref: 'step:stepid00',
        message: 'Keys in DB content not present in trace-step output: userStories',
      },
    ]);
  });

  it('flags an array-size mismatch as BLOCK when the trace had MORE elements', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'C1', content: { items: [1, 2] } })],
      [step({ output_record_id: 'C1', payload: { output: { items: [1, 2, 3] } } })],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'C1',
        ref: 'step:stepid00 field:items',
        message: 'Array size mismatch on persist: trace[items]=3, db[items]=2',
      },
    ]);
  });

  it('flags an array-size mismatch as WARN when the trace had FEWER elements', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'C2', content: { items: [1, 2, 3] } })],
      [step({ output_record_id: 'C2', payload: { output: { items: [1] } } })],
    );
    expect(res).toHaveLength(1);
    expect(res[0].severity).toBe('WARN');
    expect(res[0].ref).toBe('step:stepid00 field:items');
    expect(res[0].message).toBe('Array size mismatch on persist: trace[items]=1, db[items]=3');
  });

  it('matches via json_parsed fallback using parsed_top_level_keys metadata', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'D1', sub_phase_id: '4.1', content: { components: [1] } })],
      [
        step({
          sub_phase_id: '4.1',
          step_type: 'json_parsed',
          ts: '2026-01-01T00:00:05Z',
          metadata: { parsed_top_level_keys: ['components'] },
          payload: { parsed: { components: [1], dropped_key: 9 } },
        }),
      ],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '4.1',
        record_id: 'D1',
        ref: 'step:stepid00',
        message: 'Keys in trace-step output dropped at persist boundary: dropped_key',
      },
    ]);
  });

  it('matches via normalized fallback deriving keys from payload.output', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'E1', sub_phase_id: '5.1', content: { data_models: [1] } })],
      [
        step({
          sub_phase_id: '5.1',
          step_type: 'normalized',
          ts: '2026-01-01T00:00:05Z',
          payload: { output: { data_models: [1], surplus_free: 1 } },
        }),
      ],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '5.1',
        record_id: 'E1',
        ref: 'step:stepid00',
        message: 'Keys in trace-step output dropped at persist boundary: surplus_free',
      },
    ]);
  });

  it('produces nothing when the fallback candidate keys do not intersect', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'F1', sub_phase_id: '6.1', content: { alpha: 1 } })],
      [step({ sub_phase_id: '6.1', ts: '2026-01-01T00:00:05Z', payload: { output: { beta: 2 } } })],
    );
    expect(res).toEqual([]);
  });

  it('breaks out of the fallback scan when a step is newer than produced_at', () => {
    const res = categoryJ_persistence(
      [
        artifact({
          record_id: 'G1',
          sub_phase_id: '7.1',
          produced_at: '2026-01-01T00:00:05Z',
          content: { gamma: 1 },
        }),
      ],
      [step({ sub_phase_id: '7.1', ts: '2026-01-01T00:00:10Z', payload: { output: { gamma: 1, extra: 2 } } })],
    );
    expect(res).toEqual([]);
  });

  it('ignores non-artifact_produced records and records without a sub_phase_id', () => {
    const res = categoryJ_persistence(
      [
        artifact({ record_id: 'H1', record_type: 'decomposition_node', content: { x: 1 } }),
        artifact({ record_id: 'H2', sub_phase_id: null, content: { x: 1 } }),
      ],
      [
        step({ output_record_id: 'H1', payload: { output: { x: 1, y: 2 } } }),
        step({ output_record_id: 'H2', payload: { output: { x: 1, y: 2 } } }),
      ],
    );
    expect(res).toEqual([]);
  });

  it('skips a non-object or null trace output', () => {
    const strOut = categoryJ_persistence(
      [artifact({ record_id: 'I1', content: { x: 1 } })],
      [step({ output_record_id: 'I1', payload: { output: 'notanobject' } })],
    );
    expect(strOut).toEqual([]);

    const nullOut = categoryJ_persistence(
      [artifact({ record_id: 'I2', content: { x: 1 } })],
      [step({ output_record_id: 'I2', payload: { output: null } })],
    );
    expect(nullOut).toEqual([]);
  });

  it('excludes kind and schemaVersion from dropped and surplus on both sides', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'J1', content: { real: 1, schemaVersion: 5 } })],
      [step({ output_record_id: 'J1', payload: { output: { real: 1, kind: 'z' } } })],
    );
    expect(res).toEqual([]);
  });

  it('sorts sub-phase steps and picks the LAST overlapping step as the fallback', () => {
    const res = categoryJ_persistence(
      [
        artifact({
          record_id: 'M1',
          sub_phase_id: '8.1',
          produced_at: '2026-01-01T00:00:30Z',
          content: { shared: 1 },
        }),
      ],
      [
        step({
          step_id: 'SECOND00-x',
          sub_phase_id: '8.1',
          ts: '2026-01-01T00:00:20Z',
          payload: { output: { shared: 1, only_second: 3 } },
        }),
        step({
          step_id: 'FIRST000-x',
          sub_phase_id: '8.1',
          ts: '2026-01-01T00:00:10Z',
          payload: { output: { shared: 1, only_first: 2 } },
        }),
      ],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '8.1',
        record_id: 'M1',
        ref: 'step:SECOND00',
        message: 'Keys in trace-step output dropped at persist boundary: only_second',
      },
    ]);
  });

  it('never selects a json_parsed fallback step that lacks parsed_top_level_keys metadata', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'K1', sub_phase_id: '9.1', content: { alpha: 1 } })],
      [
        step({
          sub_phase_id: '9.1',
          ts: '2026-01-01T00:00:05Z',
          step_type: 'json_parsed',
          payload: { parsed: { alpha: 1, would_be_dropped: 2 } },
        }),
      ],
    );
    expect(res).toEqual([]);
  });

  it('emits dropped, renamed, array-size, then surplus in that order for one artifact', () => {
    const res = categoryJ_persistence(
      [artifact({ record_id: 'N1', content: { userStories: [1], shared_arr: [1, 2], only_db: 7 } })],
      [
        step({
          output_record_id: 'N1',
          payload: { output: { user_stories: [1], shared_arr: [1, 2, 3], truly_dropped: 5 } },
        }),
      ],
    );
    expect(res).toEqual([
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'N1',
        ref: 'step:stepid00',
        message: 'Keys in trace-step output dropped at persist boundary: truly_dropped',
      },
      {
        category: 'J',
        severity: 'INFO',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'N1',
        ref: 'step:stepid00',
        message: 'Normalizer renamed 1 key(s): user_stories→userStories',
      },
      {
        category: 'J',
        severity: 'BLOCK',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'N1',
        ref: 'step:stepid00 field:shared_arr',
        message: 'Array size mismatch on persist: trace[shared_arr]=3, db[shared_arr]=2',
      },
      {
        category: 'J',
        severity: 'INFO',
        phase_id: '3',
        sub_phase_id: '3.1',
        record_id: 'N1',
        ref: 'step:stepid00',
        message: 'Keys in DB content not present in trace-step output: userStories,only_db',
      },
    ]);
  });

  it('accumulates findings across multiple artifacts in artifact order', () => {
    const res = categoryJ_persistence(
      [
        artifact({ record_id: 'X1', content: { foo: 1 } }),
        artifact({ record_id: 'X2', content: { bar: 1 } }),
      ],
      [
        step({ output_record_id: 'X1', payload: { output: { foo: 1, dropX1: 2 } } }),
        step({ output_record_id: 'X2', payload: { output: { bar: 1, dropX2: 2 } } }),
      ],
    );
    expect(res.map((f) => [f.record_id, f.message])).toEqual([
      ['X1', 'Keys in trace-step output dropped at persist boundary: dropX1'],
      ['X2', 'Keys in trace-step output dropped at persist boundary: dropX2'],
    ]);
  });
});
