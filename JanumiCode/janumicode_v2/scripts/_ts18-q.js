/* eslint-disable */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const WS = 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-18';
const db = new Database(`${WS}/.janumicode/test-harness/1779319128596.db`, { readonly: true });

// (1) Packet for increment-click-counter
console.log('==================================================');
console.log('# PART 1 — packet for task-comp-redirect-service-increment-click-counter');
console.log('==================================================');
const targetTask = 'task-comp-redirect-service-increment-click-counter';
const packets = db.prepare(`
  SELECT id, content FROM governed_stream
  WHERE record_type='implementation_packet' AND is_current_version=1
`).all().map(r => ({ id: r.id, c: JSON.parse(r.content) }));
const ip = packets.find(p => p.c.task?.id === targetTask);
if (!ip) console.log('NOT FOUND'); else {
  const c = ip.c;
  console.log(JSON.stringify({
    packet_id: c.packet_id,
    task: c.task,
    user_stories: c.user_stories,
    nfrs: c.nfrs,
    component_id: c.component?.id,
    component_responsibilities: c.component?.responsibilities,
    component_active_constraints: c.component?.active_constraints,
    data_models: c.data_models,
    api_definitions: c.api_definitions,
    test_cases: c.test_cases,
    evaluation_criteria: c.evaluation_criteria,
    active_constraints: c.active_constraints,
    compliance_items: c.compliance_items,
    depends_on_packets: c.depends_on_packets,
    coherence: c.coherence,
  }, null, 2));
}

// (2) Executor prompts & outcomes for all 20 dispatched invocations
console.log('\n\n==================================================');
console.log('# PART 2 — executor outcomes (per invocation)');
console.log('==================================================');

const aiRows = db.prepare(`
  SELECT id, content FROM governed_stream
  WHERE record_type='agent_invocation' AND is_current_version=1
    AND content LIKE '%goose_cli%'
  ORDER BY produced_at
`).all();

const aoRows = db.prepare(`
  SELECT id, content FROM governed_stream
  WHERE record_type='agent_output' AND is_current_version=1
`).all().map(r => ({ id: r.id, c: JSON.parse(r.content) }));

const liveDir = path.join(WS, '.janumicode', 'live');
function readTailIfExists(invId) {
  const p = path.join(liveDir, `phase09_9_1__${invId}.log`);
  if (!fs.existsSync(p)) return { exists: false };
  const stat = fs.statSync(p);
  const fd = fs.openSync(p, 'r');
  const size = stat.size;
  const readBytes = Math.min(size, 3500);
  const buf = Buffer.alloc(readBytes);
  fs.readSync(fd, buf, 0, readBytes, Math.max(0, size - readBytes));
  fs.closeSync(fd);
  return { exists: true, sizeBytes: size, tail: buf.toString('utf8') };
}

for (const r of aiRows) {
  const c = JSON.parse(r.content);
  const taskId = c.task_id;
  const inv = c.invocation_id;
  const ao = aoRows.find(o => o.c.invocation_id === inv);
  console.log('\n--------------------------------------------------');
  console.log(`task:        ${taskId}`);
  console.log(`invocation:  ${inv}`);
  console.log(`started:     ${c.started_at}`);
  console.log(`status (ai): ${c.status}`);
  if (ao) {
    console.log(`status (ao): ${ao.c.status}  exit_code=${ao.c.exit_code}  duration_ms=${ao.c.duration_ms}`);
    if (ao.c.error) console.log(`error:       ${String(ao.c.error).slice(0, 300)}`);
    if (ao.c.response) {
      const r = ao.c.response;
      console.log(`response tail (last 500 chars): ${String(r).slice(-500)}`);
    }
  } else {
    console.log('agent_output: (none — invocation never produced an output record)');
  }
  const live = readTailIfExists(inv);
  if (live.exists) {
    console.log(`live log size: ${live.sizeBytes} bytes`);
    console.log(`live log tail:`);
    // Skip the prompt section — show last ~30 lines
    const lines = live.tail.split('\n');
    console.log(lines.slice(-30).join('\n'));
  } else {
    console.log(`live log: NOT FOUND for ${inv}`);
  }
}
