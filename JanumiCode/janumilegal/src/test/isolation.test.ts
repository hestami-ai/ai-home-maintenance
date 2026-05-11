/**
 * Wave 0 gate: two-matter isolation test.
 *
 * Per docs/janumilegal_implementation_roadmap.md Wave 0 gate:
 *   "Synthetic two-matter test: a query issued under matter A's scope
 *    cannot return any row from matter B."
 *
 * This is the binding architectural test. If it ever regresses, the build
 * does not ship.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { openDirect, FirmDal } from '../lib/database/index.js';

const FIRM_ID = 'firm_jclaw';
const CLIENT_A_ID = 'client_a';
const CLIENT_B_ID = 'client_b';
const MATTER_A_ID = 'matter_a';
const MATTER_B_ID = 'matter_b';

describe('two-matter isolation', () => {
  let dir: string;
  let db: ReturnType<typeof openDirect>;
  let firmDal: FirmDal;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jl-iso-'));
    const dbPath = path.join(dir, 'platform.sqlite');
    db = openDirect(dbPath);
    firmDal = new FirmDal(db);

    firmDal.insertFirm(FIRM_ID, 'JC Law', 'MD');
    firmDal.insertClient(FIRM_ID, CLIENT_A_ID, 'Client A');
    firmDal.insertClient(FIRM_ID, CLIENT_B_ID, 'Client B');
    firmDal.insertMatter({
      firmId: FIRM_ID,
      clientId: CLIENT_A_ID,
      matterId: MATTER_A_ID,
      matterName: 'Custody Enforcement A',
      practiceArea: 'family_law',
      primaryJurisdiction: 'MD',
      matterType: 'custody_visitation_enforcement',
    });
    firmDal.insertMatter({
      firmId: FIRM_ID,
      clientId: CLIENT_B_ID,
      matterId: MATTER_B_ID,
      matterName: 'Custody Enforcement B',
      practiceArea: 'family_law',
      primaryJurisdiction: 'MD',
      matterType: 'custody_visitation_enforcement',
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("DAL scoped to matter A cannot return matter B's rows", () => {
    const dalA = firmDal.scopeTo({ firmId: FIRM_ID, clientId: CLIENT_A_ID, matterId: MATTER_A_ID });
    const dalB = firmDal.scopeTo({ firmId: FIRM_ID, clientId: CLIENT_B_ID, matterId: MATTER_B_ID });

    dalA.insert('artifacts', {
      artifact_id: 'art_a_1',
      artifact_type: 'research_memo',
      version_hash: 'hash_a',
      state_of_origin: 'DraftMemoGenerate',
      payload_json: '{"title":"memo A"}',
      created_at: new Date().toISOString(),
    });
    dalB.insert('artifacts', {
      artifact_id: 'art_b_1',
      artifact_type: 'research_memo',
      version_hash: 'hash_b',
      state_of_origin: 'DraftMemoGenerate',
      payload_json: '{"title":"memo B"}',
      created_at: new Date().toISOString(),
    });

    const aRows = dalA.selectAll<{ artifact_id: string }>('artifacts');
    const bRows = dalB.selectAll<{ artifact_id: string }>('artifacts');

    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
    expect(aRows[0].artifact_id).toBe('art_a_1');
    expect(bRows[0].artifact_id).toBe('art_b_1');

    // Critical: dalA must not see matter B's artifact even by id
    const leak = dalA.selectAll('artifacts', { artifact_id: 'art_b_1' });
    expect(leak).toHaveLength(0);
  });

  it("DAL scoped to matter A cannot UPDATE matter B's rows", () => {
    const dalA = firmDal.scopeTo({ firmId: FIRM_ID, clientId: CLIENT_A_ID, matterId: MATTER_A_ID });
    const dalB = firmDal.scopeTo({ firmId: FIRM_ID, clientId: CLIENT_B_ID, matterId: MATTER_B_ID });

    dalB.insert('artifacts', {
      artifact_id: 'art_b_1',
      artifact_type: 'research_memo',
      version_hash: 'hash_b',
      state_of_origin: 'DraftMemoGenerate',
      payload_json: '{"title":"memo B"}',
      created_at: new Date().toISOString(),
    });

    const changes = dalA.update('artifacts', { release_status: 'approved_for_external_use' }, { artifact_id: 'art_b_1' });
    expect(changes).toBe(0);

    const bRow = dalB.selectOne<{ release_status: string }>('artifacts', { artifact_id: 'art_b_1' });
    expect(bRow?.release_status).toBe('internal_draft');
  });

  it('scopeTo refuses a matter that does not exist', () => {
    expect(() =>
      firmDal.scopeTo({ firmId: FIRM_ID, clientId: CLIENT_A_ID, matterId: 'matter_does_not_exist' }),
    ).toThrow(/matter not found in scope/);
  });

  it('listAccessibleMatters excludes screened-out matters', () => {
    firmDal.insertUser({ firmId: FIRM_ID, userId: 'user_1', displayName: 'Test User', role: 'attorney' });
    firmDal.grantAccess({
      firmId: FIRM_ID,
      userId: 'user_1',
      clientId: CLIENT_A_ID,
      matterId: MATTER_A_ID,
      role: 'drafter',
      grantedBy: 'admin',
      grantBasis: 'engagement letter',
    });
    firmDal.grantAccess({
      firmId: FIRM_ID,
      userId: 'user_1',
      clientId: CLIENT_B_ID,
      matterId: MATTER_B_ID,
      role: 'screened_out',
      grantedBy: 'admin',
      grantBasis: 'former-client conflict screen',
    });

    const accessible = firmDal.listAccessibleMatters(FIRM_ID, 'user_1');
    expect(accessible).toHaveLength(1);
    expect(accessible[0].matterId).toBe(MATTER_A_ID);
  });
});
