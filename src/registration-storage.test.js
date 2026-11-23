import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('migration carries forward legacy split decisions and conservatively marks category origins', () => {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort().filter(f => !f.startsWith('0005'))) sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  sqlite.prepare("INSERT INTO year_categories(year,flow_id,category) VALUES(2026,'flow-1','Hobbi - Férfi')").run();
  sqlite.prepare(`INSERT INTO collision_cases(case_key,original_flow_id,athlete_ids_json,evidence_json,reasons_json,resolution_json,updated_at)
    VALUES('multi:flow-1','flow-1','["1","2","3"]','{}','[]',?,'now')`).run(JSON.stringify({ action: 'split', athlete_id: '2', flow_id: 'flow-2' }));
  sqlite.exec(readFileSync('migrations/0005_registration_review.sql', 'utf8'));
  assert.equal(sqlite.prepare('SELECT origin FROM year_categories').get().origin, 'legacy');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM registration_review_cases').get().n, 1);
  assert.deepEqual(sqlite.prepare('SELECT athlete_id_a,athlete_id_b FROM registration_separations ORDER BY athlete_id_a').all().map(r => [r.athlete_id_a, r.athlete_id_b]), [['1', '2'], ['2', '3']]);
  sqlite.close();
});

