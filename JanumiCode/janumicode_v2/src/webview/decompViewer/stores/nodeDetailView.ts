/**
 * Decomposition Viewer — node-detail view model.
 *
 * Pure mapping from a fetched governed_stream record's raw `content` to a
 * render-ready {@link NodeDetailView} the drawer can display generically. Kept
 * out of the Svelte component (and free of DOM/store deps) so it's unit
 * testable and the drawer stays a dumb renderer. One mapper per decomposition
 * family; unknown record types degrade to a title + raw key list rather than
 * throwing.
 *
 * Chips may carry a navigation ref (`refKind` + `refId`) so the drawer can
 * make component / AC references clickable — the resolution to a record_id
 * happens in the drawer (which has store access); the normalizer only tags the
 * semantic of each id.
 */

import type { DecompLayer } from './snapshot';

export interface NodeDetailPayload {
  record_id: string;
  record_type: string;
  content: Record<string, unknown>;
}

/** A single chip; `refKind`/`refId` present when the id can be navigated to. */
export interface NodeDetailChip {
  text: string;
  refKind?: 'component' | 'ac';
  refId?: string;
}

/** A labelled group of chips — rendered as wrapping chips or a stacked list. */
export interface NodeDetailSection {
  heading: string;
  kind: 'chips' | 'list';
  items: NodeDetailChip[];
}

export interface NodeDetailView {
  record_id: string;
  record_type: string;
  layer: DecompLayer | 'other';
  display_key: string;
  title: string;
  status: string;
  /** Short inline meta badges (task_type, complexity, entity kind, test type). */
  badges: string[];
  description?: string;
  /** Test expected outcome (test layer only). */
  outcome?: string;
  sections: NodeDetailSection[];
}

// ── small guarded accessors ─────────────────────────────────────────

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strArr = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string');

const plain = (text: string): NodeDetailChip => ({ text });
const comp = (id: string): NodeDetailChip => ({ text: id, refKind: 'component', refId: id });
const acChip = (id: string): NodeDetailChip => ({ text: id, refKind: 'ac', refId: id });

/** Push a section only when it has content (keeps the drawer free of empty headings). */
function pushSection(sections: NodeDetailSection[], heading: string, kind: 'chips' | 'list', items: NodeDetailChip[]): void {
  if (items.length > 0) sections.push({ heading, kind, items });
}

function buildTask(p: NodeDetailPayload): NodeDetailView {
  const c = p.content;
  const t = obj(c.task);
  const sections: NodeDetailSection[] = [];
  const compChips = [str(t.component_id) ? comp(str(t.component_id)) : null, str(t.component_responsibility) ? plain(str(t.component_responsibility)) : null]
    .filter((x): x is NodeDetailChip => x !== null);
  pushSection(sections, 'Component', 'chips', compChips);
  pushSection(
    sections, 'Completion Criteria', 'list',
    arr(t.completion_criteria).map((raw) => {
      const cc = obj(raw);
      const verifies = strArr(cc.verifies_acceptance_criteria);
      const head = `${str(cc.criterion_id, 'CC')}: ${str(cc.description)}`;
      const text = verifies.length ? `${head}  → verifies ${verifies.join(', ')}` : head;
      return plain(text);
    }),
  );
  pushSection(sections, 'Verifies ACs', 'chips', strArr(t.traces_to).filter((x) => x.startsWith('AC-')).map(acChip));
  pushSection(sections, 'Writes', 'chips', strArr(t.write_directory_paths).map(plain));
  pushSection(sections, 'Reads', 'chips', strArr(t.read_directory_paths).map(plain));
  pushSection(sections, 'Depends on', 'chips', strArr(t.dependency_task_ids).map(plain));
  pushSection(sections, 'Traces to', 'chips', strArr(t.traces_to).map((x) => (x.startsWith('AC-') ? acChip(x) : plain(x))));
  pushSection(sections, 'Constraints', 'chips', strArr(t.active_constraints).map(plain));
  return {
    record_id: p.record_id, record_type: p.record_type, layer: 'task',
    display_key: str(c.display_key, str(t.id)), title: str(t.name, str(t.id)), status: str(c.status, 'pending'),
    badges: [str(t.task_type), t.estimated_complexity ? `complexity: ${str(t.estimated_complexity)}` : ''].filter(Boolean),
    description: str(t.description) || undefined,
    sections,
  };
}

function buildTest(p: NodeDetailPayload): NodeDetailView {
  const c = p.content;
  const tc = obj(c.test_case);
  const sections: NodeDetailSection[] = [];
  pushSection(sections, 'Verifies ACs', 'chips', strArr(tc.acceptance_criterion_ids).map(acChip));
  pushSection(sections, 'Components', 'chips', strArr(tc.component_ids).map(comp));
  pushSection(sections, 'Preconditions', 'list', strArr(tc.preconditions).map(plain));
  pushSection(
    sections, 'Steps', 'list',
    arr(tc.steps).map((raw, i) => {
      const s = obj(raw);
      return plain(`${str(s.id, `step-${i + 1}`)}: ${str(s.description)}`);
    }),
  );
  pushSection(sections, 'Constraints', 'chips', strArr(tc.active_constraints).map(plain));
  return {
    record_id: p.record_id, record_type: p.record_type, layer: 'test',
    display_key: str(c.display_key, str(tc.id)), title: str(tc.name, str(tc.id)), status: str(c.status, 'pending'),
    badges: [tc.test_type ? `type: ${str(tc.test_type)}` : ''].filter(Boolean),
    outcome: str(tc.expected_outcome) || undefined,
    sections,
  };
}

function buildComponent(p: NodeDetailPayload): NodeDetailView {
  const c = p.content;
  const cm = obj(c.component);
  const sections: NodeDetailSection[] = [];
  pushSection(
    sections, 'Responsibilities', 'list',
    arr(cm.responsibilities).map((raw) => {
      const r = obj(raw);
      return plain(typeof raw === 'string' ? raw : str(r.description, str(r.id)));
    }),
  );
  pushSection(
    sections, 'Dependencies', 'chips',
    arr(cm.dependencies).map((raw) => {
      if (typeof raw === 'string') return comp(raw);
      const d = obj(raw);
      const id = str(d.component_id);
      const kind = str(d.kind);
      return id ? { text: kind ? `${id} (${kind})` : id, refKind: 'component' as const, refId: id } : plain(kind);
    }).filter((ch) => ch.text),
  );
  pushSection(sections, 'Traces to', 'chips', strArr(cm.traces_to).map(plain));
  pushSection(sections, 'Constraints', 'chips', strArr(cm.active_constraints).map(plain));
  return {
    record_id: p.record_id, record_type: p.record_type, layer: 'component',
    display_key: str(c.display_key, str(cm.id)), title: str(cm.name, str(cm.id)), status: str(c.status, 'pending'),
    badges: [cm.domain_id ? `domain: ${str(cm.domain_id)}` : ''].filter(Boolean),
    description: str(c.decomposition_rationale) || undefined,
    sections,
  };
}

function buildDataModel(p: NodeDetailPayload): NodeDetailView {
  const c = p.content;
  const e = obj(c.entity);
  const sections: NodeDetailSection[] = [];
  if (str(e.component_id)) pushSection(sections, 'Component', 'chips', [comp(str(e.component_id))]);
  pushSection(
    sections, 'Fields', 'list',
    arr(e.fields).map((raw) => {
      const f = obj(raw);
      const text = typeof raw === 'string' ? raw : `${str(f.name)}: ${str(f.type)}`;
      return plain(text);
    }).filter((ch) => ch.text.trim() !== ':'),
  );
  pushSection(
    sections, 'Relationships', 'chips',
    arr(e.relationships).map((raw) => {
      const r = obj(raw);
      const kind = str(r.kind);
      return plain(typeof raw === 'string' ? raw : `${str(r.target_entity_id)}${kind ? ` (${kind})` : ''}`);
    }).filter((ch) => ch.text),
  );
  pushSection(sections, 'Traces to', 'chips', strArr(e.traces_to).map(plain));
  pushSection(sections, 'Constraints', 'chips', strArr(e.active_constraints).map(plain));
  return {
    record_id: p.record_id, record_type: p.record_type, layer: 'data_model',
    display_key: str(c.display_key, str(e.id)), title: str(e.name, str(e.id)), status: str(c.status, 'pending'),
    badges: [e.kind ? `kind: ${str(e.kind)}` : '', str(e.component_id) ? `component: ${str(e.component_id)}` : 'no component'].filter(Boolean),
    description: str(c.decomposition_rationale) || undefined,
    sections,
  };
}

const BUILDERS: Record<string, (p: NodeDetailPayload) => NodeDetailView> = {
  task_decomposition_node: buildTask,
  test_decomposition_node: buildTest,
  component_decomposition_node: buildComponent,
  data_model_decomposition_node: buildDataModel,
};

/** Map a fetched record to a render-ready detail view (defensive on shape). */
export function buildNodeDetailView(p: NodeDetailPayload): NodeDetailView {
  const builder = BUILDERS[p.record_type];
  if (builder) return builder(p);
  // Unknown type — degrade gracefully to a title + a flat key dump.
  const c = p.content;
  return {
    record_id: p.record_id, record_type: p.record_type, layer: 'other',
    display_key: str(c.display_key, p.record_id), title: str(c.display_key, p.record_type), status: str(c.status, ''),
    badges: [],
    sections: [{ heading: 'Fields', kind: 'chips', items: Object.keys(c).map(plain) }],
  };
}
