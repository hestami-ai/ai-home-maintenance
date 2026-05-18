/**
 * `pnpm regression:status` — list fixtures with staleness flags.
 */
import { loadFixtures } from '../loadFixtures.js';

const STALE_DAYS = 90;

function ageDays(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function main(): void {
  const fixtures = loadFixtures();
  if (fixtures.size === 0) {
    console.log('No fixtures found.');
    return;
  }
  const rows = Array.from(fixtures.values()).map(({ fixture }) => {
    const last = fixture.last_rebaselined_at ?? fixture.extracted_at;
    const days = ageDays(last);
    return {
      id: fixture.fixture_id,
      template: `${fixture.template_ref.agent_role}/${fixture.template_ref.sub_phase}`,
      extracted_at: fixture.extracted_at,
      last_rebaselined_at: fixture.last_rebaselined_at ?? '-',
      age_days: days,
      stale: days >= STALE_DAYS,
    };
  });
  rows.sort((a, b) => a.id.localeCompare(b.id));
  for (const r of rows) {
    const flag = r.stale ? '  STALE' : '';
    console.log(`${r.id}`);
    console.log(`  template          : ${r.template}`);
    console.log(`  extracted_at      : ${r.extracted_at}`);
    console.log(`  last_rebaselined  : ${r.last_rebaselined_at}`);
    console.log(`  age_days          : ${r.age_days}${flag}`);
  }
}

main();
