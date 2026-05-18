import Database from 'better-sqlite3';
const db = new Database('test-and-evaluation/thin-slice-workspaces/thin-slice-workspace-12/.janumicode/test-harness/resume-1778807876090.db', { readonly: true });
const ids = [
  'c8d0702f-5c40-406f-b899-c22f4954ebaa',
  'bfcc044d-9bf0-4bba-a38c-01a3786d4f3f',
  '6eddc511-ded7-4aa3-80f9-226f3e95f877',
  '754df327-b562-47f8-8c2a-7db07c1cd64d',
  '80409f5b-3ecd-409f-8554-3e044a621fb2',
  '7b344537-9abc-4e7a-8147-f899587f8761',
];
const sql = "SELECT json_extract(content,'$.system') as s, json_extract(content,'$.prompt') as p, json_extract(content,'$.response_format') as rf, sub_phase_id FROM governed_stream WHERE id=?";
for (const id of ids) {
  const r = db.prepare(sql).get(id) as { s: string|null; p: string|null; rf: string|null; sub_phase_id: string } | undefined;
  console.log(id, '|', r?.sub_phase_id, '| sys=', (r?.s||'').length, '| prompt=', (r?.p||'').length, '| rf=', r?.rf);
}
db.close();
