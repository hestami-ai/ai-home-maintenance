const Database = require('better-sqlite3');
const db = new Database('test-workspace/.janumicode/database.db', { readonly: true });

const normalizeTs = (ts) => ts.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');

// Get architecture_presentation events
const events = db.prepare(
  "SELECT event_id, event_type, timestamp, detail " +
  "FROM dialogue_events " +
  "WHERE event_type = 'architecture_presentation' " +
  "ORDER BY timestamp ASC"
).all();

// Get architecture gates in chronological order
const gates = db.prepare(
  "SELECT g.gate_id, g.status, g.created_at, g.resolved_at, gm.metadata " +
  "FROM gates g " +
  "INNER JOIN gate_metadata gm ON g.gate_id = gm.gate_id " +
  "WHERE gm.metadata LIKE '%ARCHITECTURE_REVIEW%' " +
  "ORDER BY g.created_at ASC"
).all();

console.log('=== SIMULATING FIXED MATCHING ===\n');

for (let i = 0; i < events.length; i++) {
  const e = events[i];
  const eventTimeNorm = normalizeTs(e.timestamp);
  console.log('Event #' + (i+1) + ': timestamp=' + e.timestamp + '  normalized=' + eventTimeNorm);

  let bestGate = null;
  for (const g of gates) {
    const meta = JSON.parse(g.metadata);
    const gateTimeNorm = normalizeTs(g.created_at);
    const isAfter = gateTimeNorm >= eventTimeNorm;
    console.log('  Gate ' + g.gate_id.substring(0, 8) + ' (' + g.status + '): ' +
      'created_at=' + g.created_at + '  normalized=' + gateTimeNorm +
      '  >= event? ' + isAfter);

    if (gateTimeNorm >= eventTimeNorm) {
      bestGate = g;
      console.log('  >>> MATCHED: ' + g.status);
      break;
    }
    // Fallback — keep updating
    bestGate = g;
  }

  if (bestGate) {
    console.log('  RESULT: gate=' + bestGate.gate_id.substring(0, 8) + '  status=' + bestGate.status);
  } else {
    console.log('  RESULT: no match');
  }
  console.log('');
}

db.close();
