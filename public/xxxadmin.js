const categories = [
  'Nyílt - Női', 'Nyílt - Férfi', 'Hobbi - Női', 'Hobbi - Férfi',
  'Kezdő - Női', 'Kezdő - Férfi', 'Senior - Női', 'Senior - Férfi',
];
const seasonNames = { Spring: 'Tavasz', Summer: 'Nyár', Autumn: 'Ősz', Winter: 'Tél' };
const seasonOrder = { Spring: 1, Summer: 2, Autumn: 3, Winter: 4 };
const reasonNames = {
  potential_match: 'potential match', merged: 'merged',
  same_event_collision: 'same-event collision', overlapping_event: 'overlapping event',
  score_disparity: '2× score difference', top_ten: 'top-10 impact',
};
const $ = selector => document.querySelector(selector);
let athletes = [], reviews = [];

function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}

async function api(path, body) {
  const response = await fetch(`/api/admin/${path}?year=2026`, body === undefined
    ? { cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'A kérés nem sikerült.');
  return data;
}

function warnings(data) {
  $('#admin-warning').textContent = data.warnings?.length
    ? `Hiányzó forrásarchívumok: ${data.warnings.length}. Az identitásdöntések mentése és a jelöltfrissítés blokkolva.` : '';
}

function select(options, value, labelText) {
  const label = element('label', labelText, 'admin-filter');
  const input = element('select');
  for (const [value, text] of options) {
    const option = element('option', text);
    option.value = value;
    input.append(option);
  }
  input.value = value || '';
  label.append(input);
  return { label, input };
}

function categorySelect(value, labelText) {
  return select([['', 'Kategória választása…'], ...categories.map(c => [c, c])], value, labelText);
}

function table(rows, showFlow = false) {
  const columns = [['season', 'Esemény'], ['athlete_id', 'VL ID'], ...(showFlow ? [['flow_id', 'Aktuális Flow ID']] : []),
    ['name', 'Név'], ['category', 'Kategória'], ['presence', 'Forrásban'], ['rank', 'Helyezés'], ['score', 'Pont']];
  const wrap = element('div', null, 'admin-table-wrap');
  const table = element('table', null, 'admin-evidence-table');
  const head = element('thead'), heading = element('tr'), body = element('tbody');
  for (const [key, name] of columns) {
    const th = element('th', name, ['rank', 'score'].includes(key) ? 'numeric' : '');
    th.scope = 'col';
    heading.append(th);
  }
  head.append(heading);
  for (const row of rows) {
    const tr = element('tr');
    const presence = [row.ranking ? 'rangsor' : '', row.startlist ? 'rajtlista' : ''].filter(Boolean).join(' + ');
    const display = { ...row, season: seasonNames[row.season] || row.season,
      presence: presence + (row.historical ? ' (archív)' : '') };
    for (const [key] of columns) tr.append(element('td', display[key] ?? '—', ['rank', 'score'].includes(key) ? 'numeric' : ''));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function badge(text, danger = false) {
  return element('span', text, `admin-issue-type${danger ? ' admin-issue-type-danger' : ''}`);
}

function renderCategory(athlete) {
  const card = element('article', null, 'admin-candidate');
  card.append(element('h2', athlete.name), element('p', `${athlete.flow_id} · VL: ${athlete.athlete_ids.join(', ')}`, 'admin-identifiers'));
  if (athlete.category_change) card.append(badge('kategóriaváltás — azonos VL ID'));
  if (athlete.assignment_mismatch) card.append(badge('assignment mismatch', true));
  card.append(element('p', `Year category eredete: ${athlete.origin || 'nincs'}`, 'admin-identifiers'), table(athlete.sources));
  const form = element('form', null, 'admin-category-form');
  const category = categorySelect(athlete.year_category, `Year category — ${athlete.flow_id}`);
  category.input.required = true;
  const save = element('button', 'Mentés', 'admin-save');
  save.type = 'submit';
  const result = element('p', '', 'admin-save-status');
  result.setAttribute('role', 'status');
  form.append(category.label, save, result);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    save.disabled = true;
    try {
      await api('year-categories', { flow_id: athlete.flow_id, category: category.input.value });
      await loadAll();
      $('#category-status').textContent += ' · Mentve. Csak a Total változott.';
    } catch (error) { result.textContent = error.message; }
    finally { save.disabled = false; }
  });
  card.append(form);
  return card;
}

function renderCategories() {
  const term = $('#category-search').value.toLocaleLowerCase('hu');
  const filter = $('#category-filter').value;
  const visible = athletes.filter(a => (!filter || a[filter]) &&
    `${a.name} ${a.flow_id} ${a.athlete_ids.join(' ')}`.toLocaleLowerCase('hu').includes(term));
  $('#category-status').textContent = `${visible.length} / ${athletes.length} sportoló`;
  $('#category-candidates').replaceChildren(...visible.map(renderCategory));
}

function renderReview(review) {
  const card = element('article', null, 'admin-candidate');
  const rows = review.members.flatMap(m => m.sources.length
    ? m.sources.map(s => ({ ...s, athlete_id: m.athlete_id, flow_id: m.flow_id }))
    : [{ athlete_id: m.athlete_id, flow_id: m.flow_id }]);
  card.append(element('h2', rows.find(r => r.name)?.name || review.case_id));
  const badges = element('div', null, 'collision-reasons');
  badges.append(badge(review.to_decide ? 'to-decide' : 'reviewed', review.to_decide));
  for (const reason of review.reasons) badges.append(badge(reasonNames[reason] || reason, reason === 'same_event_collision'));
  if (review.separations.length) badges.append(badge('kept separate'));
  card.append(badges, table(rows, true));
  card.append(element('p', 'A hasonló név nem bizonyítja, hogy egy személy. A táblázat az aktuális állapotot mutatja; a változásokat lent állíthatod be.'));
  const form = element('form');
  const assignments = new Map(review.members.map(m => [m.athlete_id, m.flow_id]));
  const categoryDraft = new Map();
  const choicesDraft = new Map(review.choices.map(c => [JSON.stringify([c.import_id, c.flow_id]), c.entry_id]));
  const selection = new Map();
  const assignmentInputs = new Map();
  const options = [...new Set(review.members.flatMap(m => [m.flow_id, `flow-${m.athlete_id}`]))].map(f => [f, f]);
  const controls = element('div', null, 'review-assignments');
  const categoriesArea = element('div', null, 'review-categories');
  const choicesArea = element('div', null, 'review-choices');
  const actionBar = element('div', null, 'collision-actions');
  const merge = element('button', 'Kijelöltek összevonása', 'admin-save');
  const separate = element('button', 'Mind külön személy', 'admin-save');
  merge.type = separate.type = 'button';
  actionBar.append(merge, separate);
  function updateProjection() {
    for (const [id, input] of assignmentInputs) input.value = assignments.get(id);
    const flows = [...new Set(assignments.values())];
    const categoryFields = [];
    for (const flow of flows) {
      const ids = [...assignments].filter(([, target]) => target === flow).map(([id]) => id);
      const unchanged = review.members.filter(m => m.flow_id === flow).map(m => m.athlete_id).sort().join('|') === [...ids].sort().join('|');
      const current = review.categories.find(c => c.flow_id === flow);
      const latest = rows.filter(r => ids.includes(r.athlete_id) && r.entry_id != null && r.category)
        .sort((a, b) => seasonOrder[b.season] - seasonOrder[a.season] || (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];
      const key = JSON.stringify([flow, [...ids].sort()]);
      const category = categorySelect(categoryDraft.get(key) || (unchanged ? current?.year_category : latest?.category), `Year category: ${flow} (VL ${ids.join(', ')})`);
      category.input.required = true;
      categoryDraft.set(key, category.input.value);
      category.input.addEventListener('change', () => categoryDraft.set(key, category.input.value));
      categoryFields.push(category.label);
    }
    categoriesArea.replaceChildren(element('h3', 'Erősítsd meg minden személy éves kategóriáját'), ...categoryFields);
    const groups = new Map();
    for (const row of rows.filter(r => r.entry_id != null)) {
      const flow = assignments.get(row.athlete_id);
      const key = JSON.stringify([row.import_id, flow]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const choiceFields = [];
    for (const [key, entries] of groups) {
      if (entries.length < 2) continue;
      const choice = select([['', 'Eredmény választása…'], ...entries.map(r => [String(r.entry_id), `VL ${r.athlete_id}: ${r.rank ?? '—'}. hely · ${r.score} pont`])],
        String(choicesDraft.get(key) || ''), `same-event collision — ${seasonNames[entries[0].season]} · ${JSON.parse(key)[1]}`);
      choice.input.required = true;
      choice.input.addEventListener('change', () => choicesDraft.set(key, Number(choice.input.value)));
      choiceFields.push(choice.label);
    }
    choicesArea.replaceChildren(...choiceFields);
    return { flows, groups };
  }
  for (const member of review.members) {
    const row = element('div', null, 'review-assignment');
    const checkLabel = element('label', `VL ${member.athlete_id}`);
    const check = element('input');
    check.type = 'checkbox';
    checkLabel.prepend(check);
    selection.set(member.athlete_id, check);
    const destination = select(options, member.flow_id, `VL ${member.athlete_id} személye`);
    destination.input.addEventListener('change', () => { assignments.set(member.athlete_id, destination.input.value); updateProjection(); });
    assignmentInputs.set(member.athlete_id, destination.input);
    row.append(checkLabel, destination.label);
    controls.append(row);
  }
  merge.addEventListener('click', () => {
    const ids = [...selection].filter(([, check]) => check.checked).map(([id]) => id);
    if (ids.length < 2) { result.textContent = 'Legalább két VL ID-t jelölj ki.'; return; }
    const target = assignments.get(ids[0]);
    for (const id of ids) assignments.set(id, target);
    updateProjection();
  });
  separate.addEventListener('click', () => {
    for (const member of review.members) assignments.set(member.athlete_id, `flow-${member.athlete_id}`);
    updateProjection();
  });
  const save = element('button', 'Döntés mentése / módosítása', 'admin-save');
  save.type = 'submit';
  const result = element('p', '', 'admin-save-status');
  result.setAttribute('role', 'status');
  form.append(controls, actionBar, categoriesArea, choicesArea, save, result);
  updateProjection();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!window.confirm('Mented az összerendeléseket, a különválasztásokat és az éves kategóriákat? A Total újraszámolódik.')) return;
    const { flows, groups } = updateProjection();
    const confirmedCategories = flows.map(flow => {
      const ids = [...assignments].filter(([, f]) => f === flow).map(([id]) => id).sort();
      return { flow_id: flow, category: categoryDraft.get(JSON.stringify([flow, ids])) };
    });
    const choices = [...groups].filter(([, entries]) => entries.length > 1).map(([key]) => {
      const [import_id, flow_id] = JSON.parse(key);
      return { import_id, flow_id, entry_id: choicesDraft.get(key) };
    });
    save.disabled = true;
    try {
      await api('registration-reviews', { case_id: review.case_id, signature: review.signature,
        assignments: [...assignments].map(([athlete_id, flow_id]) => ({ athlete_id, flow_id })), categories: confirmedCategories, choices });
      await loadAll();
    } catch (error) { result.textContent = error.message; save.disabled = false; }
  });
  card.append(form);
  return card;
}

function renderReviews() {
  const filter = $('#review-filter').value;
  const term = $('#review-search').value.toLocaleLowerCase('hu');
  const visible = reviews.filter(r => {
    const matches = filter === 'to_decide' ? r.to_decide : filter === 'kept_separate' ? r.separations.length > 0 : !filter || r.reasons.includes(filter);
    return matches && r.members.some(m => `${m.athlete_id} ${m.flow_id} ${m.sources.map(s => s.name).join(' ')}`.toLocaleLowerCase('hu').includes(term));
  });
  $('#review-status').textContent = `${visible.length} / ${reviews.length} eset · ${visible.filter(r => r.to_decide).length} to-decide`;
  $('#review-candidates').replaceChildren(...visible.map(renderReview));
}

async function loadAll() {
  const [cats, cases] = await Promise.all([api('year-categories'), api('registration-reviews')]);
  athletes = cats.athletes;
  reviews = cases.cases;
  warnings(cases);
  renderCategories();
  renderReviews();
}

function activateTab() {
  // Old collision links now lead to the consolidated multi-reg workspace.
  const active = ['#collision', '#multi-registration'].includes(location.hash) ? 'multi-registration' : 'categories';
  for (const name of ['categories', 'multi-registration']) {
    $(`#${name}-panel`).hidden = name !== active;
    const tab = $(`#${name}-tab`);
    if (name === active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}
for (const id of ['category-search', 'category-filter']) $(`#${id}`).addEventListener('input', renderCategories);
for (const id of ['review-search', 'review-filter']) $(`#${id}`).addEventListener('input', renderReviews);
$('#refresh-candidates').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  $('#review-status').textContent = 'Jelöltek frissítése…';
  try {
    const data = await api('registration-reviews/refresh', {});
    reviews = data.cases;
    warnings(data);
    renderReviews();
  } catch (error) { $('#review-status').textContent = error.message; }
  finally { button.disabled = false; }
});
window.addEventListener('hashchange', activateTab);
activateTab();
loadAll().catch(error => { $('#admin-warning').textContent = error.message; });
