// Simulate buildTraceSelection + buildTraceText with the actual records.
const Database = require('better-sqlite3');
const db = new Database(process.argv[2], { readonly: true });
const wfid = 'f16a7853-9d60-47b1-bf94-579087d64b60';
const iid = '2331d527-e649-4740-a672-ee4a88589a15';

const recs = db.prepare(`
  SELECT * FROM governed_stream
  WHERE workflow_run_id = ? AND phase_id = '9' AND sub_phase_id = '9.1'
    AND is_current_version = 1
    AND (
      produced_by_record_id = ?
      OR (record_type = 'agent_invocation' AND json_extract(content, '$.invocation_id') = ?)
    )
  ORDER BY produced_at ASC
`).all(wfid, iid, iid);

const typeMap = { agent_reasoning_step: 'agent_reasoning_step', agent_self_correction: 'agent_self_correction', tool_call: 'tool_call', tool_result: 'tool_result' };
const traceRecords = recs.filter(r => r.record_type in typeMap).map((r, i) => ({
  id: r.id, type: typeMap[r.record_type], content: r.content, sequencePosition: i,
  tokenCount: Math.ceil(r.content.length / 4),
}));

// Inline ContextBuilder.buildTraceSelection
function buildTraceSelection(traceRecords, isExecutorAgent, traceMaxTokens) {
  const selected = new Set();
  let totalTokens = 0;
  for (const r of traceRecords) if (r.type === 'agent_self_correction') { selected.add(r.id); totalTokens += r.tokenCount; }
  for (const r of traceRecords) if (r.type === 'tool_call') { selected.add(r.id); totalTokens += r.tokenCount; }
  const reasoningSteps = traceRecords.filter(r => r.type === 'agent_reasoning_step');
  if (reasoningSteps.length > 0) {
    selected.add(reasoningSteps[0].id); totalTokens += reasoningSteps[0].tokenCount;
    if (reasoningSteps.length > 1) {
      const last = reasoningSteps[reasoningSteps.length - 1];
      selected.add(last.id); totalTokens += last.tokenCount;
    }
  }
  return { selectedRecordIds: Array.from(selected), samplingApplied: false, strideN: null, totalTokens };
}

const sel = buildTraceSelection(traceRecords, true, 8000);
console.log('selected count:', sel.selectedRecordIds.length);
console.log('totalTokens:', sel.totalTokens);

// buildTraceText
const selectedSet = new Set(sel.selectedRecordIds);
const selected = traceRecords.filter(r => selectedSet.has(r.id));
const traceText = selected.map(r => {
  const prefix = r.type === 'agent_self_correction' ? '[SELF-CORRECTION]'
    : r.type === 'tool_call' ? '[TOOL CALL]' : '[REASONING]';
  return `${prefix} (seq ${r.sequencePosition}):\n${r.content}`;
}).join('\n\n---\n\n');

console.log('trace text length:', traceText.length);
console.log('first 500 chars of traceText:');
console.log(traceText.slice(0, 500));
