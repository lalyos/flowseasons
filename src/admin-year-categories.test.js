import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from './index.js';
import { nameMatch, categoryAthletes } from './registration-review.js';
import { processR2Notification } from './import.js';
import { totalRebuildStatements } from './totals.js';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  for (const file of readdirSync('migrations').sort()) sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  const objects = new Map();
  function prepare(sql, values = []) {
    return {
      sql, values,
      bind: (...args) => prepare(sql, args),
      all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
      first: async () => sqlite.prepare(sql).get(...values) || null,
      run: async () => sqlite.prepare(sql).run(...values),
    };
  }
  const env = {
    DB: {
      prepare,
      batch: async statements => {
        sqlite.exec('BEGIN');
        try {
          const result = statements.map(s => sqlite.prepare(s.sql).all(...s.values));
          sqlite.exec('COMMIT');
          return result;
        } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
    },
    RAW_RESULTS: {
      get: async key => objects.has(key) ? {
        json: async () => objects.get(key), text: async () => JSON.stringify(objects.get(key)), uploaded: new Date(),
      } : null,
      put: async (key, value) => { objects.set(key, JSON.parse(value)); },
      delete: async key => { objects.delete(key); },
    },
  };
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
  let nextEntry = 1;
  function event(season, entries, startlist = entries) {
    const id = seasons.indexOf(season) + 1;
    sqlite.prepare('INSERT INTO events (event_pk,year,season) VALUES (?,2026,?)').run(id, season);
    sqlite.prepare(`INSERT INTO imports (import_id,event_pk,event_id,id,r2_key,status,accepted_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)`).run(id, id, String(id), String(id), `${season}.json`, `${id}`);
    sqlite.prepare('UPDATE events SET current_import_id = ? WHERE event_pk = ?').run(id, id);
    for (const entry of entries) {
      sqlite.prepare(`INSERT INTO event_results (entry_id,import_id,athlete_id,name,firstname,lastname,rank,source_category,score_hundredths)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(nextEntry++, id, entry.athlete_id, entry.name, entry.firstname, entry.lastname,
        entry.rank ?? 1, entry.category || 'Hobbi - Férfi', Math.round(entry.score * 100));
      sqlite.prepare('INSERT OR IGNORE INTO "athlete-linking" (athlete_id,flow_id) VALUES (?,?)').run(entry.athlete_id, entry.flow_id || `flow-${entry.athlete_id}`);
      sqlite.prepare(`INSERT OR IGNORE INTO year_categories (year,flow_id,category,origin) VALUES (2026,?,?,'import')`)
        .run(entry.flow_id || `flow-${entry.athlete_id}`, entry.category || 'Hobbi - Férfi');
    }
    const convert = entry => ({ ...entry, custom_participant_fields: [{ value: entry.category || 'Hobbi - Férfi' }] });
    objects.set(`${season}.json`, { ranking: entries.map(convert), startlist: startlist.map(convert) });
  }
  return { env, sqlite, objects, event };
}
const athlete = (id, score, extra = {}) => ({ athlete_id: id, name: 'VADÁSZ Gábor', firstname: 'Gábor', lastname: 'VADÁSZ', score, ...extra });
async function request(env, path, body) {
  const response = await worker.fetch(new Request(`https://example.test/api/admin/${path}?year=2026`, body === undefined
    ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
  return { status: response.status, data: await response.json() };
}
async function refresh(env) {
  const response = await request(env, 'registration-reviews/refresh', {});
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return response.data.cases;
}
function decision(review, assignments, categories, choices = []) {
  return { case_id: review.case_id, signature: review.signature,
    assignments: Object.entries(assignments).map(([athlete_id, flow_id]) => ({ athlete_id, flow_id })),
    categories: Object.entries(categories).map(([flow_id, category]) => ({ flow_id, category })), choices };
}

test('hidden admin route still serves its asset', async () => {
  let asset;
  const response = await worker.fetch(new Request('https://example.test/xxxadmin'), {
    ASSETS: { fetch: request => { asset = new URL(request.url).pathname; return new Response('admin'); } },
  });
  assert.equal(response.status, 200);
  assert.equal(asset, '/xxxadmin.html');
});

test('category editor includes single-category athletes and accepts corrections', async () => {
  const { env, event } = fixture();
  event('Spring', [athlete('10269', 55.3)]);
  const listed = await request(env, 'year-categories');
  assert.equal(listed.data.athletes.length, 1);
  assert.equal(listed.data.athletes[0].category_change, false);
  assert.equal((await request(env, 'year-categories', { flow_id: 'flow-10269', category: 'Nyílt - Férfi' })).status, 200);
  const corrected = (await request(env, 'year-categories')).data.athletes[0];
  assert.equal(corrected.origin, 'admin');
  assert.equal(corrected.assignment_mismatch, true);
  assert.equal(corrected.sources[0].category, 'Hobbi - Férfi');
});

test('startlist-only athletes can receive a Year category without creating results', async () => {
  const { env, event, sqlite } = fixture();
  event('Spring', [], [athlete('99', 0)]);
  const listed = await request(env, 'year-categories');
  assert.equal(listed.data.athletes[0].flow_id, 'flow-99');
  const response = await request(env, 'year-categories', { flow_id: 'flow-99', category: 'Senior - Férfi' });
  assert.equal(response.status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM event_results').get().n, 0);
  assert.equal(sqlite.prepare('SELECT origin FROM year_categories').get().origin, 'admin');
});

test('category ambiguity is restricted to changes within the same VL ID', () => {
  const data = { people: new Map([
    ['1', { athlete_id: '1', flow_id: 'merged', sources: [{ season: 'Spring', category: 'Hobbi - Férfi', entry_id: 1, name: 'A' }] }],
    ['2', { athlete_id: '2', flow_id: 'merged', sources: [{ season: 'Summer', category: 'Nyílt - Férfi', entry_id: 2, name: 'A' }] }],
  ]), categories: new Map() };
  assert.equal(categoryAthletes(data)[0].category_change, false);
  data.people.get('1').sources.push({ season: 'Autumn', category: 'Nyílt - Férfi', entry_id: 3, name: 'A' });
  assert.equal(categoryAthletes(data)[0].category_change, true);
});

test('refresh discovers IDs already present before Winter and never changes scores or mappings', async () => {
  const { env, sqlite, event } = fixture();
  event('Summer', [athlete('10036', 128.73)]);
  event('Autumn', [athlete('23362', 80.29)]);
  event('Winter', [athlete('23362', 111.92)]);
  await env.DB.batch(totalRebuildStatements(env));
  const before = JSON.stringify(sqlite.prepare('SELECT * FROM total_standings ORDER BY flow_id').all());
  const cases = await refresh(env);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].members.length, 2);
  assert.equal(cases[0].to_decide, true);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM total_standings ORDER BY flow_id').all()), before);
  assert.equal(sqlite.prepare('SELECT COUNT(DISTINCT flow_id) AS n FROM "athlete-linking"').get().n, 2);
  assert.equal((await refresh(env))[0].case_id, cases[0].case_id);
});

test('merge, keep separate, and re-merge are reversible; both categories are explicit', async () => {
  const { env, sqlite, event } = fixture();
  event('Spring', [athlete('10269', 55.3)]);
  event('Summer', [athlete('20149', 1442.53, { category: 'Nyílt - Férfi' })]);
  let review = (await refresh(env))[0];
  let result = await request(env, 'registration-reviews', decision(review,
    { '10269': 'flow-10269', '20149': 'flow-10269' }, { 'flow-10269': 'Nyílt - Férfi' }));
  assert.equal(result.status, 200, JSON.stringify(result.data));
  review = (await refresh(env))[0];
  assert.equal(review.to_decide, false);
  result = await request(env, 'registration-reviews', decision(review,
    { '10269': 'flow-10269', '20149': 'flow-20149' }, { 'flow-10269': 'Hobbi - Férfi', 'flow-20149': 'Nyílt - Férfi' }));
  assert.equal(result.status, 200, JSON.stringify(result.data));
  review = (await refresh(env))[0];
  assert.equal(review.to_decide, false);
  assert.equal(review.separations.length, 1);
  assert.equal(sqlite.prepare("SELECT category FROM year_categories WHERE flow_id='flow-10269'").get().category, 'Hobbi - Férfi');
  assert.equal(sqlite.prepare("SELECT category FROM year_categories WHERE flow_id='flow-20149'").get().category, 'Nyílt - Férfi');
  result = await request(env, 'registration-reviews', decision(review,
    { '10269': 'flow-10269', '20149': 'flow-10269' }, { 'flow-10269': 'Hobbi - Férfi' }));
  assert.equal(result.status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM registration_separations').get().n, 0);
});

test('same-event collision requires a valid counted result, not silent summing', async () => {
  const { env, sqlite, event } = fixture();
  event('Autumn', [athlete('6043', 29.53), athlete('23231', 149.79)]);
  const review = (await refresh(env))[0];
  assert(review.reasons.includes('overlapping_event'));
  assert(!review.reasons.includes('same_event_collision'));
  const body = decision(review, { '6043': 'flow-6043', '23231': 'flow-6043' }, { 'flow-6043': 'Nyílt - Férfi' });
  assert.equal((await request(env, 'registration-reviews', body)).status, 400);
  body.choices = [{ import_id: 3, flow_id: 'flow-6043', entry_id: review.members.find(m => m.athlete_id === '23231').sources[0].entry_id }];
  assert.equal((await request(env, 'registration-reviews', body)).status, 200);
  assert.equal(sqlite.prepare("SELECT score_hundredths FROM total_standings WHERE flow_id='flow-6043'").get().score_hundredths, 14979);
  assert.equal((await refresh(env))[0].to_decide, false);
  sqlite.prepare('DELETE FROM event_results WHERE import_id = 3').run();
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM event_result_choices').get().n, 0);
});

test('new evidence reopens the same stable case; unchanged refresh preserves decisions', async () => {
  const { env, event } = fixture();
  event('Spring', [athlete('1', 100)]);
  event('Summer', [athlete('2', 110)]);
  let review = (await refresh(env))[0];
  await request(env, 'registration-reviews', decision(review, { '1': 'flow-1', '2': 'flow-2' }, { 'flow-1': 'Hobbi - Férfi', 'flow-2': 'Hobbi - Férfi' }));
  review = (await refresh(env))[0];
  assert.equal(review.to_decide, false);
  event('Winter', [athlete('3', 120)]);
  const updated = (await refresh(env))[0];
  assert.equal(updated.case_id, review.case_id);
  assert.equal(updated.members.length, 3);
  assert.equal(updated.to_decide, true);
  const stale = decision(review, { '1': 'flow-1', '2': 'flow-2' }, { 'flow-1': 'Hobbi - Férfi', 'flow-2': 'Hobbi - Férfi' });
  assert.equal((await request(env, 'registration-reviews', stale)).status, 409);
});

test('mixed review groups support merging a subset and keeping another person separate', async () => {
  const { env, event } = fixture();
  event('Spring', [athlete('1', 100)]);
  event('Summer', [athlete('2', 110)]);
  event('Autumn', [athlete('3', 120)]);
  let review = (await refresh(env))[0];
  const response = await request(env, 'registration-reviews', decision(review,
    { '1': 'flow-1', '2': 'flow-1', '3': 'flow-3' }, { 'flow-1': 'Hobbi - Férfi', 'flow-3': 'Hobbi - Férfi' }));
  assert.equal(response.status, 200);
  review = (await refresh(env))[0];
  assert.equal(review.separations.length, 2);
  assert.equal(review.to_decide, false);
});

test('invalid categories and out-of-case assignments are rejected without writes', async () => {
  const { env, event, sqlite } = fixture();
  event('Spring', [athlete('1', 100), athlete('9', 10, { firstname: 'Other', lastname: 'Person', name: 'Other Person' })]);
  event('Summer', [athlete('2', 110)]);
  const review = (await refresh(env))[0];
  assert.equal((await request(env, 'year-categories', { flow_id: 'flow-1', category: 'imaginary' })).status, 400);
  assert.equal((await request(env, 'registration-reviews', decision(review, { '1': 'flow-9', '2': 'flow-2' }, { 'flow-9': 'Hobbi - Férfi', 'flow-2': 'Hobbi - Férfi' }))).status, 400);
  assert.equal(sqlite.prepare("SELECT flow_id FROM \"athlete-linking\" WHERE athlete_id='1'").get().flow_id, 'flow-1');
});

test('missing archives block refresh instead of erasing candidate evidence', async () => {
  const { env, event, objects } = fixture();
  event('Spring', [athlete('1', 100)]);
  objects.clear();
  assert.equal((await request(env, 'registration-reviews/refresh', {})).status, 503);
});

test('name matching supports accents, swapped fields, given names, and conservative typos', () => {
  assert.equal(nameMatch({ firstname: 'Gábor', lastname: 'VADÁSZ' }, { firstname: 'Gabor', lastname: 'Vadasz' }), 'exact_name');
  assert.equal(nameMatch({ firstname: 'Mirkó', lastname: 'Rákos' }, { firstname: 'Rákos', lastname: 'Mirkó' }), 'swapped_name');
  assert.equal(nameMatch({ firstname: 'Dorka', lastname: 'Nagy' }, { firstname: 'Dorka Anna', lastname: 'Nagy' }), 'given_name');
  assert.equal(nameMatch({ firstname: 'Gabor', lastname: 'Dabi' }, { firstname: 'Gabor', lastname: 'Dab' }), 'name_variation');
  assert.equal(nameMatch({ firstname: 'Gabor', lastname: 'Dabi' }, { firstname: 'Tamas', lastname: 'Farkas' }), null);
});

test('imports preserve admin and legacy Year categories but update import-derived categories', async () => {
  const { env, event, sqlite, objects } = fixture();
  event('Spring', [athlete('1', 10), athlete('2', 20), athlete('3', 30)]);
  sqlite.prepare("UPDATE year_categories SET origin='admin' WHERE flow_id='flow-1'").run();
  sqlite.prepare("UPDATE year_categories SET origin='legacy' WHERE flow_id='flow-2'").run();
  objects.set('incoming/updated.json', {
    event: 'Flow Seasons - Tavasz', event_id: '1', id: '1', status: 'active',
    ranking: ['1', '2', '3'].map(id => ({ ...athlete(id, 100), custom_participant_fields: [{ value: 'Nyílt - Férfi' }] })),
  });
  await processR2Notification({ bucket: 'flowseasons', object: { key: 'incoming/updated.json', eTag: 'updated' }, eventTime: new Date().toISOString() }, env);
  const categories = sqlite.prepare('SELECT flow_id,category FROM year_categories ORDER BY flow_id').all();
  assert.equal(categories[0].category, 'Hobbi - Férfi');
  assert.equal(categories[1].category, 'Hobbi - Férfi');
  assert.equal(categories[2].category, 'Nyílt - Férfi');
});

test('concurrent mapping changes abort the entire decision batch', async () => {
  const { env, event, sqlite } = fixture();
  event('Spring', [athlete('1', 100)]);
  event('Summer', [athlete('2', 110)]);
  const review = (await refresh(env))[0];
  const originalBatch = env.DB.batch;
  env.DB.batch = async statements => {
    sqlite.prepare('UPDATE "athlete-linking" SET flow_id = ? WHERE athlete_id = ?').run('flow-other', '2');
    return originalBatch(statements);
  };
  const result = await request(env, 'registration-reviews', decision(review,
    { '1': 'flow-1', '2': 'flow-1' }, { 'flow-1': 'Nyílt - Férfi' }));
  assert.equal(result.status, 409);
  assert.equal(sqlite.prepare("SELECT category FROM year_categories WHERE flow_id='flow-1'").get().category, 'Hobbi - Férfi');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM registration_review_write_guards').get().n, 0);
});

test('best-three Total uses one selected score per event', async () => {
  const { env, event, sqlite } = fixture();
  for (const [season, score] of [['Spring', 10], ['Summer', 20], ['Autumn', 30], ['Winter', 40]]) event(season, [athlete('1', score)]);
  await env.DB.batch(totalRebuildStatements(env));
  assert.equal(sqlite.prepare('SELECT score_hundredths FROM total_standings').get().score_hundredths, 9000);
});
