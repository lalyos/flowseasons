import { canonicalCategory } from './import.js';
import { totalRebuildStatements } from './totals.js';

const YEAR = 2026;
const ORDER = { Spring: 1, Summer: 2, Autumn: 3, Winter: 4 };
const headers = { 'Cache-Control': 'no-store' };
const json = (value, status = 200) => Response.json(value, { status, headers });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const normalized = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const compact = value => normalized(value).replace(/[^\p{L}\p{N}]/gu, '');
const words = value => normalized(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function oneEdit(a, b) {
  if (!a || !b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + a.length - i + b.length - j <= 1;
}

export function nameMatch(a, b) {
  const af = compact(a.firstname), al = compact(a.lastname);
  const bf = compact(b.firstname), bl = compact(b.lastname);
  if (af && al && bf && bl) {
    if (af === bf && al === bl) return 'exact_name';
    if (af === bl && al === bf) return 'swapped_name';
    if (al === bl) {
      const at = words(a.firstname), bt = words(b.firstname);
      if (at.every(t => bt.includes(t)) || bt.every(t => at.includes(t))) return 'given_name';
    }
    if ((af === bf && oneEdit(al, bl)) || (al === bl && oneEdit(af, bf))) return 'name_variation';
  }
  if (compact(a.name) && compact(a.name) === compact(b.name)) return 'exact_name';
  return null;
}

export async function loadReviewData(env) {
  const [links, rows, categories, files, standings, choices] = await Promise.all([
    env.DB.prepare('SELECT athlete_id, flow_id FROM "athlete-linking"').all(),
    env.DB.prepare(`
      SELECT er.*, e.season FROM events e
      JOIN event_results er ON er.import_id = e.current_import_id
      WHERE e.year = ? ORDER BY e.event_pk, er.rank IS NULL, er.rank, er.entry_id
    `).bind(YEAR).all(),
    env.DB.prepare('SELECT flow_id, category, origin FROM year_categories WHERE year = ?').bind(YEAR).all(),
    env.DB.prepare(`
      SELECT i.r2_key, e.season, e.current_import_id FROM imports i JOIN events e ON e.event_pk = i.event_pk
      WHERE e.year = ? ORDER BY i.accepted_at, i.import_id
    `).bind(YEAR).all(),
    env.DB.prepare(`
      SELECT flow_id, RANK() OVER (PARTITION BY category ORDER BY score_hundredths DESC) AS category_rank
      FROM total_standings WHERE year = ?
    `).bind(YEAR).all(),
    env.DB.prepare('SELECT import_id, flow_id, entry_id FROM event_result_choices').all(),
  ]);
  const people = new Map();
  const flowById = new Map(links.results.map(r => [r.athlete_id, r.flow_id]));
  function person(id) {
    if (!people.has(id)) people.set(id, {
      athlete_id: id, flow_id: flowById.get(id) || `flow-${id}`, aliases: [], sources: [],
    });
    return people.get(id);
  }
  for (const link of links.results) person(link.athlete_id);
  for (const row of rows.results) {
    if (!row.athlete_id) continue;
    const athlete = person(row.athlete_id);
    athlete.aliases.push({ name: row.name, firstname: row.firstname, lastname: row.lastname });
    athlete.sources.push({
      season: row.season, name: row.name, category: canonicalCategory(row.source_category),
      rank: row.rank, score: row.score_hundredths / 100, entry_id: row.entry_id,
      import_id: row.import_id, ranking: true, startlist: false, historical: false,
    });
  }
  const warnings = [];
  for (const file of files.results) {
    try {
      const object = await env.RAW_RESULTS.get(file.r2_key);
      if (!object) throw new Error('Archive not available');
      const payload = await object.json();
      for (const section of ['ranking', 'startlist']) {
        for (const entry of Array.isArray(payload[section]) ? payload[section] : []) {
          if (entry?.athlete_id == null) continue;
          const athlete = person(String(entry.athlete_id));
          athlete.aliases.push({ name: entry.name, firstname: entry.firstname, lastname: entry.lastname });
          let sources = athlete.sources.filter(s => s.season === file.season);
          if (!sources.length) {
            sources = [{ season: file.season, name: entry.name || null, category: null,
              rank: null, score: null, entry_id: null, import_id: null,
              ranking: false, startlist: false, historical: true }];
            athlete.sources.push(...sources);
          }
          for (const source of sources) {
            if (section === 'startlist') source.startlist = true;
            if (source.historical) {
              source.name = entry.name || source.name;
              source.category = (Array.isArray(entry.custom_participant_fields) ? entry.custom_participant_fields : [])
                .map(f => canonicalCategory(f?.value)).find(Boolean) || source.category;
              if (section === 'ranking') source.ranking = true;
            }
          }
        }
      }
    } catch (error) {
      warnings.push(file.r2_key);
      console.error(JSON.stringify({ message: 'Registration evidence unavailable', key: file.r2_key, error: error.message }));
    }
  }
  for (const athlete of people.values()) {
    athlete.aliases = [...new Map(athlete.aliases.map(a => [JSON.stringify(a), a])).values()];
    athlete.sources.sort((a, b) => ORDER[a.season] - ORDER[b.season] || (a.rank ?? Infinity) - (b.rank ?? Infinity));
  }
  return {
    people, links: flowById, warnings,
    currentImports: new Map(files.results.map(f => [f.season, f.current_import_id])),
    categories: new Map(categories.results.map(r => [r.flow_id, r])),
    topTen: new Set(standings.results.filter(r => r.category_rank <= 10).map(r => r.flow_id)),
    choices: choices.results,
  };
}

export function categoryAthletes(data) {
  const groups = new Map();
  for (const athlete of data.people.values()) {
    if (!groups.has(athlete.flow_id)) groups.set(athlete.flow_id, []);
    groups.get(athlete.flow_id).push(athlete);
  }
  return [...groups].map(([flow_id, members]) => {
    const sources = members.flatMap(a => a.sources.map(s => ({ ...s, athlete_id: a.athlete_id })));
    const latest = sources.filter(s => s.entry_id != null).sort((a, b) => ORDER[b.season] - ORDER[a.season] || (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];
    const current = data.categories.get(flow_id);
    const observed = new Set(sources.filter(s => s.entry_id != null && s.category).map(s => s.category));
    return {
      flow_id, athlete_ids: members.map(a => a.athlete_id),
      name: latest?.name || sources.find(s => s.name)?.name || flow_id,
      year_category: current?.category || null, origin: current?.origin || null,
      suggested_category: latest?.category || null,
      category_change: members.some(a => new Set(a.sources.filter(s => s.entry_id != null && s.category).map(s => s.category)).size > 1),
      assignment_mismatch: Boolean(current && observed.size && !observed.has(current.category)),
      sources,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'hu'));
}

export function reviewReasons(members, data) {
  const reasons = new Set();
  const flowIds = new Set(members.map(m => m.flow_id));
  if (flowIds.size > 1) reasons.add('potential_match');
  if (flowIds.size < members.length) reasons.add('merged');
  const scored = members.flatMap(m => m.sources.filter(s => s.entry_id != null).map(s => ({ ...s, athlete_id: m.athlete_id, flow_id: m.flow_id })));
  const events = new Map();
  for (const s of scored) {
    const key = JSON.stringify([s.flow_id, s.season]);
    events.set(key, (events.get(key) || 0) + 1);
  }
  if ([...events.values()].some(n => n > 1)) reasons.add('same_event_collision');
  if (new Set(scored.map(s => s.season)).size < scored.length) reasons.add('overlapping_event');
  if (scored.some((a, i) => scored.slice(i + 1).some(b => a.athlete_id !== b.athlete_id && a.score > 0 && b.score > 0 && Math.max(a.score, b.score) >= 2 * Math.min(a.score, b.score)))) reasons.add('score_disparity');
  if (members.some(m => data.topTen.has(m.flow_id))) reasons.add('top_ten');
  return [...reasons].sort();
}

// The signature ignores scan time and risk-rank changes, but detects new source evidence or assignments.
export function reviewSignature(members, data) {
  const ids = members.map(m => m.athlete_id).sort();
  return JSON.stringify({
    people: [...members].sort((a, b) => a.athlete_id.localeCompare(b.athlete_id)).map(m => ({
      athlete_id: m.athlete_id, flow_id: m.flow_id,
      sources: m.sources.map(s => ({ season: s.season, name: s.name, category: s.category, rank: s.rank, score: s.score, ranking: s.ranking, startlist: s.startlist })),
    })),
    choices: data.choices.filter(c => members.some(m => m.flow_id === c.flow_id))
      .map(c => ({ import_id: c.import_id, flow_id: c.flow_id, entry_id: c.entry_id }))
      .sort((a, b) => a.import_id - b.import_id || a.flow_id.localeCompare(b.flow_id)),
    separations: (data.separations || []).filter(p => ids.includes(p.athlete_id_a) && ids.includes(p.athlete_id_b)),
  });
}

export function candidateGroups(data, saved) {
  const parent = new Map([...data.people.keys()].map(id => [id, id]));
  const root = id => {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, root(parent.get(id)));
    return parent.get(id);
  };
  const join = ids => { for (const id of ids.slice(1)) parent.set(root(id), root(ids[0])); };
  const flows = new Map();
  for (const athlete of data.people.values()) {
    if (!flows.has(athlete.flow_id)) flows.set(athlete.flow_id, []);
    flows.get(athlete.flow_id).push(athlete.athlete_id);
  }
  for (const ids of flows.values()) join(ids);
  const athletes = [...data.people.values()];
  for (let i = 0; i < athletes.length; i++) {
    for (let j = i + 1; j < athletes.length; j++) {
      if (athletes[i].aliases.some(a => athletes[j].aliases.some(b => nameMatch(a, b)))) {
        join([athletes[i].athlete_id, athletes[j].athlete_id]);
      }
    }
  }
  for (const row of saved) join(JSON.parse(row.athlete_ids_json));
  const groups = new Map();
  for (const id of parent.keys()) {
    const key = root(id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  return [...groups.values()].filter(ids => ids.length > 1).map(ids => ids.sort());
}

async function storedCases(env) {
  const { results } = await env.DB.prepare('SELECT * FROM registration_review_cases ORDER BY case_id').all();
  return results;
}

async function withSeparations(env, data) {
  const { results } = await env.DB.prepare('SELECT athlete_id_a, athlete_id_b FROM registration_separations ORDER BY athlete_id_a, athlete_id_b').all();
  data.separations = results;
  return data;
}

function caseMembers(ids, data) {
  return ids.map(id => data.people.get(id) || { athlete_id: id, flow_id: `flow-${id}`, aliases: [], sources: [] });
}

export async function refreshCandidates(env) {
  const data = await withSeparations(env, await loadReviewData(env));
  // Incomplete archives must not erase evidence or incorrectly close candidate reviews.
  if (data.warnings.length) throw fail('Source archives are missing; restore local R2 archives before refreshing candidates.', 503);
  const saved = await storedCases(env);
  const now = new Date().toISOString();
  const statements = [];
  for (const ids of candidateGroups(data, saved)) {
    const previous = saved.filter(row => JSON.parse(row.athlete_ids_json).some(id => ids.includes(id)));
    const retained = previous[0];
    const members = caseMembers(ids, data);
    const signature = reviewSignature(members, data);
    // Preserve explicit migrated decisions on the first scan; later changes reopen them.
    const unchangedMembership = retained && JSON.stringify(JSON.parse(retained.athlete_ids_json).sort()) === JSON.stringify(ids);
    const reviewed = retained?.signature == null && retained?.decision_json && previous.length === 1 && unchangedMembership
      ? signature : retained?.reviewed_signature || null;
    statements.push(env.DB.prepare(`
      INSERT INTO registration_review_cases
        (case_id, athlete_ids_json, reasons_json, evidence_json, signature, reviewed_signature, decision_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(case_id) DO UPDATE SET
        athlete_ids_json = excluded.athlete_ids_json, reasons_json = excluded.reasons_json,
        evidence_json = excluded.evidence_json, signature = excluded.signature,
        reviewed_signature = excluded.reviewed_signature, updated_at = excluded.updated_at
    `).bind(retained?.case_id || crypto.randomUUID(), JSON.stringify(ids), JSON.stringify(reviewReasons(members, data)), JSON.stringify(members), signature, reviewed, retained?.decision_json || null, now));
    for (const duplicate of previous.slice(1)) {
      statements.push(env.DB.prepare('DELETE FROM registration_review_cases WHERE case_id = ?').bind(duplicate.case_id));
    }
  }
  if (statements.length) await env.DB.batch(statements);
}

export async function listCases(env, data) {
  data ||= await withSeparations(env, await loadReviewData(env));
  const saved = await storedCases(env);
  return {
    year: YEAR, warnings: data.warnings,
    cases: saved.map(row => {
      const members = caseMembers(JSON.parse(row.athlete_ids_json), data);
      const signature = reviewSignature(members, data);
      const memberIds = new Set(members.map(m => m.athlete_id));
      const separations = data.separations.filter(p => memberIds.has(p.athlete_id_a) && memberIds.has(p.athlete_id_b));
      return {
        case_id: row.case_id, revision: row.updated_at, signature, members, reasons: reviewReasons(members, data),
        to_decide: signature !== row.reviewed_signature,
        decision: row.decision_json ? JSON.parse(row.decision_json) : null,
        separations,
        categories: categoryAthletes({ ...data, people: new Map(members.map(m => [m.athlete_id, m])) }),
        choices: data.choices.filter(c => members.some(m => m.flow_id === c.flow_id)),
      };
    }),
  };
}

export function validateDecision(body, review, data) {
  if (!Array.isArray(body.assignments) || !Array.isArray(body.categories) || !Array.isArray(body.choices)) throw fail('assignments, categories and choices are required');
  if (body.signature !== review.signature) throw fail('Evidence changed. Reload this case before saving.', 409);
  const members = new Set(review.members.map(m => m.athlete_id));
  const targets = new Set(review.members.flatMap(m => [m.flow_id, `flow-${m.athlete_id}`]));
  const assignments = new Map();
  for (const row of body.assignments) {
    if (!row || !members.has(row.athlete_id) || !targets.has(row.flow_id) || assignments.has(row.athlete_id)) throw fail('Invalid or duplicate athlete assignment');
    if ([...data.links].some(([id, flow]) => flow === row.flow_id && !members.has(id))) throw fail('Destination includes athletes outside this review case', 409);
    assignments.set(row.athlete_id, row.flow_id);
  }
  if (assignments.size !== members.size) throw fail('Every VL ID must have an assignment');
  const flows = new Set(assignments.values());
  const categories = new Map();
  for (const row of body.categories) {
    const category = canonicalCategory(row?.category);
    if (!row || !flows.has(row.flow_id) || !category || categories.has(row.flow_id)) throw fail('Each resulting person needs one valid Year category');
    categories.set(row.flow_id, category);
  }
  if (categories.size !== flows.size) throw fail('Confirm the Year category of every resulting person');
  const collisions = new Map();
  for (const member of review.members) for (const source of member.sources.filter(s => s.entry_id != null)) {
    const flow = assignments.get(member.athlete_id);
    const key = JSON.stringify([source.import_id, flow]);
    if (!collisions.has(key)) collisions.set(key, []);
    collisions.get(key).push(source.entry_id);
  }
  const choices = new Map();
  for (const row of body.choices) {
    const key = JSON.stringify([row?.import_id, row?.flow_id]);
    const entries = collisions.get(key);
    if (!entries || entries.length < 2 || !entries.includes(row.entry_id) || choices.has(key)) throw fail('Invalid counted-result selection');
    choices.set(key, row);
  }
  for (const [key, entries] of collisions) if (entries.length > 1 && !choices.has(key)) throw fail('Choose one counted result for every same-event collision');
  return { assignments, categories, choices: [...choices.values()] };
}

async function saveDecision(env, body) {
  const data = await withSeparations(env, await loadReviewData(env));
  const response = await listCases(env, data);
  const review = response.cases.find(c => c.case_id === body.case_id);
  if (!review) throw fail('Review case not found', 404);
  if (response.warnings.length) throw fail('Source evidence is incomplete; cannot save identity decisions.', 503);
  const decision = validateDecision(body, review, data);
  const now = new Date().toISOString();
  const statements = [];
  const token = crypto.randomUUID();
  const guard = (sql, values) => statements.push(env.DB.prepare(`
    INSERT INTO registration_review_write_guards (token, valid)
    SELECT ?, CASE WHEN ${sql} THEN 1 ELSE 0 END
  `).bind(token, ...values));
  for (const member of review.members) {
    const original = data.links.get(member.athlete_id);
    guard('(SELECT flow_id FROM "athlete-linking" WHERE athlete_id = ?) IS ?', [member.athlete_id, original ?? null]);
  }
  for (const flow of new Set([...review.members.map(m => m.flow_id), ...decision.assignments.values()])) {
    const count = [...data.links.values()].filter(f => f === flow).length;
    guard('(SELECT COUNT(*) FROM "athlete-linking" WHERE flow_id = ?) = ?', [flow, count]);
  }
  for (const importId of new Set(review.members.flatMap(m => m.sources.filter(s => s.import_id != null).map(s => s.import_id)))) {
    guard('EXISTS (SELECT 1 FROM events WHERE year = ? AND current_import_id = ?)', [YEAR, importId]);
  }
  guard('(SELECT updated_at FROM registration_review_cases WHERE case_id = ?) = ?', [review.case_id, review.revision]);
  guard('(SELECT COUNT(*) FROM events WHERE year = ?) = ?', [YEAR, data.currentImports.size]);
  for (const [season, importId] of data.currentImports) {
    guard('(SELECT current_import_id FROM events WHERE year = ? AND season = ?) IS ?', [YEAR, season, importId]);
  }
  const oldFlows = new Set(review.members.map(m => m.flow_id));
  for (const [id, flow] of decision.assignments) {
    statements.push(env.DB.prepare(`INSERT INTO "athlete-linking" (athlete_id, flow_id) VALUES (?, ?)
      ON CONFLICT(athlete_id) DO UPDATE SET flow_id = excluded.flow_id`).bind(id, flow));
  }
  // Persist every cross-person separation, and remove rejected separations when re-merging.
  const ids = [...decision.assignments.keys()].sort();
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    if (decision.assignments.get(a) === decision.assignments.get(b)) {
      statements.push(env.DB.prepare('DELETE FROM registration_separations WHERE athlete_id_a = ? AND athlete_id_b = ?').bind(a, b));
    } else {
      statements.push(env.DB.prepare(`INSERT INTO registration_separations (athlete_id_a, athlete_id_b, updated_at)
        VALUES (?, ?, ?) ON CONFLICT(athlete_id_a, athlete_id_b) DO UPDATE SET updated_at = excluded.updated_at`).bind(a, b, now));
    }
  }
  for (const [flow, category] of decision.categories) {
    statements.push(env.DB.prepare(`INSERT INTO year_categories (year, flow_id, category, origin) VALUES (?, ?, ?, 'admin')
      ON CONFLICT(year, flow_id) DO UPDATE SET category = excluded.category, origin = 'admin'`).bind(YEAR, flow, category));
  }
  for (const flow of new Set([...oldFlows, ...decision.assignments.values()])) {
    statements.push(env.DB.prepare('DELETE FROM event_result_choices WHERE flow_id = ?').bind(flow));
    statements.push(env.DB.prepare(`DELETE FROM year_categories WHERE year = ? AND flow_id = ?
      AND NOT EXISTS (SELECT 1 FROM "athlete-linking" WHERE flow_id = ?)`).bind(YEAR, flow, flow));
  }
  for (const choice of decision.choices) {
    statements.push(env.DB.prepare('INSERT INTO event_result_choices (import_id, flow_id, entry_id, updated_at) VALUES (?, ?, ?, ?)')
      .bind(choice.import_id, choice.flow_id, choice.entry_id, now));
  }
  const projected = review.members.map(m => ({ ...m, flow_id: decision.assignments.get(m.athlete_id) }));
  const projectedData = { ...data,
    choices: [...data.choices.filter(c => !oldFlows.has(c.flow_id)), ...decision.choices],
    separations: [...data.separations.filter(p => !ids.includes(p.athlete_id_a) || !ids.includes(p.athlete_id_b)),
      ...ids.flatMap((a, i) => ids.slice(i + 1).filter(b => decision.assignments.get(a) !== decision.assignments.get(b)).map(b => ({ athlete_id_a: a, athlete_id_b: b })))],
  };
  projectedData.separations.sort((a, b) => a.athlete_id_a.localeCompare(b.athlete_id_a) || a.athlete_id_b.localeCompare(b.athlete_id_b));
  const signature = reviewSignature(projected, projectedData);
  statements.push(env.DB.prepare(`UPDATE registration_review_cases SET signature = ?, reviewed_signature = ?,
    decision_json = ?, evidence_json = ?, updated_at = ? WHERE case_id = ?`).bind(
    signature, signature, JSON.stringify({ assignments: body.assignments, categories: body.categories, choices: decision.choices, updated_at: now }),
    JSON.stringify(projected), now, body.case_id,
  ));
  statements.push(...totalRebuildStatements(env));
  statements.push(env.DB.prepare('DELETE FROM registration_review_write_guards WHERE token = ?').bind(token));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (error.message.includes('CHECK constraint failed')) throw fail('Evidence changed during save. Reload this case.', 409);
    throw error;
  }
  return { ok: true };
}

export async function adminRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const allowed = ['/api/admin/year-categories', '/api/admin/registration-reviews', '/api/admin/registration-reviews/refresh'];
  if (!allowed.includes(path)) return json({ error: 'Admin endpoint replaced; reload /xxxadmin.' }, 410);
  const methods = path.endsWith('/refresh') ? ['POST'] : ['GET', 'POST'];
  if (!methods.includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: methods.join(', ') } });
  if (url.searchParams.get('year') !== String(YEAR)) return json({ error: 'year must be 2026' }, 400);
  try {
    if (path.endsWith('/refresh')) {
      await refreshCandidates(env);
      return json(await listCases(env));
    }
    if (request.method === 'GET') {
      if (path.endsWith('/registration-reviews')) return json(await listCases(env));
      const data = await loadReviewData(env);
      return json({ year: YEAR, athletes: categoryAthletes(data), warnings: data.warnings });
    }
    let body;
    try { body = await request.json(); } catch { throw fail('request body must be JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('request body must be an object');
    if (path.endsWith('/registration-reviews')) return json(await saveDecision(env, body));
    const category = canonicalCategory(body.category);
    if (typeof body.flow_id !== 'string' || !category) throw fail('flow_id and a valid category are required');
    const known = await env.DB.prepare('SELECT 1 AS found FROM "athlete-linking" WHERE flow_id = ? LIMIT 1').bind(body.flow_id).first();
    const seed = [];
    if (!known) {
      const data = await loadReviewData(env);
      const athlete = [...data.people.values()].find(m => m.flow_id === body.flow_id && !data.links.has(m.athlete_id));
      if (!athlete) throw fail('Athlete not found', 404);
      seed.push(env.DB.prepare('INSERT OR IGNORE INTO "athlete-linking" (athlete_id, flow_id) VALUES (?, ?)').bind(athlete.athlete_id, body.flow_id));
    }
    await env.DB.batch([
      ...seed,
      env.DB.prepare(`INSERT INTO year_categories (year, flow_id, category, origin) VALUES (?, ?, ?, 'admin')
        ON CONFLICT(year, flow_id) DO UPDATE SET category = excluded.category, origin = 'admin'`).bind(YEAR, body.flow_id, category),
      ...totalRebuildStatements(env),
    ]);
    return json({ flow_id: body.flow_id, category });
  } catch (error) {
    if (!error.status) console.error(JSON.stringify({ message: 'Admin review failed', error: error.message }));
    return json({ error: error.status ? error.message : 'Unable to process admin review' }, error.status || 500);
  }
}
