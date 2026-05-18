/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('node:path');
const db = new Database(
  path.resolve(__dirname, '..', 'test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-5/.janumicode/test-harness/1778448716098.db'),
  { readonly: true },
);

// What top-level keys exist in content for the dominant record types?
const types = ['agent_invocation', 'agent_output', 'artifact_produced', 'decision_trace', 'reasoning_review_finding_record', 'requirement_decomposition_node'];
for (const t of types) {
  const rows = db.prepare(`SELECT content FROM governed_stream WHERE record_type=? AND is_current_version=1 LIMIT 3`).all(t);
  const keyCounts = {};
  for (const r of rows) {
    const c = JSON.parse(r.content);
    for (const k of Object.keys(c)) keyCounts[k] = (keyCounts[k] ?? 0) + 1;
  }
  console.log(`\n${t} (sampled ${rows.length}): top-level keys:`);
  console.log(' ', Object.keys(keyCounts).join(', '));
  // Check the camelCase fields the embedder expects
  const want = ['text', 'responseText', 'summary', 'description', 'statement', 'rationale'];
  const present = want.filter(w => keyCounts[w]);
  console.log('  embedder-expected keys present:', present.length ? present.join(', ') : '(NONE)');
  // Check snake_case alternates
  const snakeWant = ['response_text', 'response', 'prompt', 'prompt_text', 'content_text'];
  const snakePresent = snakeWant.filter(w => keyCounts[w]);
  console.log('  snake_case alternates present:', snakePresent.length ? snakePresent.join(', ') : '(none)');
}
