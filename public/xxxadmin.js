const categories = [
  "Nyílt - Női", "Nyílt - Férfi",
  "Hobbi - Női", "Hobbi - Férfi",
  "Kezdő - Női", "Kezdő - Férfi",
  "Senior - Női", "Senior - Férfi",
];
const seasonNames = { Spring: "Tavasz", Summer: "Nyár", Autumn: "Ősz", Winter: "Tél" };
const presenceNames = {
  ranking_and_startlist: "Rangsor + rajtlista",
  ranking: "Csak rangsor",
  startlist: "Csak rajtlista",
};
const collisionReasonNames = {
  same_event_collision: "same-event collision",
  score_disparity: "2× score difference",
  top_ten: "top-10 impact",
};
const status = document.querySelector("#admin-status");
const candidates = document.querySelector("#admin-candidates");
const issueFilter = document.querySelector("#admin-issue-filter");
const multiRegistrationStatus = document.querySelector("#multi-registration-status");
const multiRegistrationCandidates = document.querySelector("#multi-registration-candidates");
const collisionStatus = document.querySelector("#collision-status");
const collisionCandidates = document.querySelector("#collision-candidates");
const collisionReasonFilter = document.querySelector("#collision-reason-filter");
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
let athletes = [];
let collisions = [];

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function evidenceTable(columns, rows) {
  const wrap = document.createElement("div");
  wrap.className = "admin-table-wrap";
  const table = document.createElement("table");
  table.className = "admin-evidence-table";
  const headRow = document.createElement("tr");
  for (const column of columns) {
    const heading = textElement("th", column.numeric ? "numeric" : "", column.label);
    heading.scope = "col";
    headRow.append(heading);
  }
  const head = document.createElement("thead");
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tableRow = document.createElement("tr");
    for (const column of columns) {
      tableRow.append(textElement("td", column.numeric ? "numeric" : "", row[column.key] ?? "—"));
    }
    body.append(tableRow);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function renderCandidate(athlete, index) {
  const card = document.createElement("article");
  card.className = "admin-candidate";
  card.append(textElement("h2", "", athlete.name || athlete.flow_id));
  card.append(textElement(
    "p",
    athlete.issue_type === "category_change" ? "admin-issue-type" : "admin-issue-type admin-issue-type-danger",
    athlete.issue_type === "category_change" ? "kategóriaváltás" : "id-problem",
  ));
  card.append(textElement(
    "p",
    "admin-identifiers",
    `Flow ID: ${athlete.flow_id} · Vertical-Life IDs: ${athlete.athlete_ids.join(", ")}`,
  ));

  card.append(evidenceTable([
    { key: "season", label: "Esemény" },
    { key: "name", label: "Név" },
    { key: "category", label: "Kategória" },
    { key: "rank", label: "Helyezés", numeric: true },
    { key: "score", label: "Pont", numeric: true },
    { key: "athlete_id", label: "VL ID" },
  ], athlete.sources.map((source) => ({
    ...source,
    season: seasonNames[source.season] || source.season,
  }))));

  const form = document.createElement("form");
  form.className = "admin-category-form";
  const label = document.createElement("label");
  label.htmlFor = `year-category-${index}`;
  label.textContent = "Végleges kategória";
  const select = document.createElement("select");
  select.id = label.htmlFor;
  select.required = true;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Kategória választása…";
  select.append(placeholder);
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    option.selected = category === athlete.year_category;
    select.append(option);
  }

  const save = document.createElement("button");
  save.className = "admin-save";
  save.type = "submit";
  save.textContent = "Mentés";
  const result = textElement("p", "admin-save-status", "");
  result.setAttribute("role", "status");
  form.append(label, select, save, result);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!select.value) return;

    save.disabled = true;
    result.textContent = "Mentés…";
    try {
      const response = await fetch("/api/admin/year-categories?year=2026", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow_id: athlete.flow_id, category: select.value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "A mentés nem sikerült.");
      athlete.year_category = data.category;
      result.textContent = `Mentve: ${data.category}`;
    } catch (error) {
      result.textContent = error instanceof Error ? error.message : "A mentés nem sikerült.";
    } finally {
      save.disabled = false;
    }
  });
  card.append(form);
  return card;
}

function registrationRows(registration) {
  return registration.athlete_ids.flatMap((athlete) => athlete.sources.length
    ? athlete.sources.map((source) => ({
      ...source,
      athlete_id: athlete.athlete_id,
      season: seasonNames[source.season] || source.season,
      presence: presenceNames[source.presence],
    }))
    : [{ athlete_id: athlete.athlete_id }]);
}

function registrationTable(registration) {
  return evidenceTable([
    { key: "season", label: "Esemény" },
    { key: "athlete_id", label: "VL ID" },
    { key: "name", label: "Név" },
    { key: "category", label: "Kategória" },
    { key: "presence", label: "Forrásban" },
    { key: "rank", label: "Helyezés", numeric: true },
    { key: "score", label: "Pont", numeric: true },
  ], registrationRows(registration));
}

function renderMultiRegistration(registration) {
  const card = document.createElement("article");
  card.className = "admin-candidate";
  card.append(textElement("h2", "", registration.name || registration.flow_id));
  card.append(textElement(
    "p",
    "admin-identifiers",
    `Flow ID: ${registration.flow_id} · ${registration.athlete_ids.length} Vertical-Life ID`,
  ));
  card.append(registrationTable(registration));
  return card;
}

function collisionButton(label, caseKey, action, extra = {}) {
  const button = textElement("button", "admin-save", label);
  button.type = "button";
  button.addEventListener("click", async () => {
    if ((action === "split" || action === "merge") && !window.confirm("Biztosan módosítod az azonosító-összerendelést?")) return;
    button.disabled = true;
    try {
      const response = await fetch("/api/admin/collisions?year=2026", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_key: caseKey, action, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "A döntést nem sikerült menteni.");
      await Promise.all([loadCandidates(), loadMultiRegistrations(), loadCollisions()]);
    } catch (error) {
      collisionStatus.textContent = error instanceof Error ? error.message : "Mentési hiba.";
      button.disabled = false;
    }
  });
  return button;
}

function renderCollision(collision) {
  const registration = collision.evidence;
  const card = document.createElement("article");
  card.className = "admin-candidate";
  card.append(textElement("h2", "", registration.name || collision.original_flow_id));
  const badges = document.createElement("div");
  badges.className = "collision-reasons";
  for (const reason of collision.reasons) {
    badges.append(textElement(
      "span",
      reason === "same_event_collision" ? "admin-issue-type admin-issue-type-danger" : "admin-issue-type",
      collisionReasonNames[reason] || reason,
    ));
  }
  card.append(badges);
  card.append(textElement("p", "admin-identifiers", `Flow ID: ${collision.original_flow_id}`));
  card.append(registrationTable(registration));
  card.append(textElement(
    "p",
    "collision-resolution",
    collision.resolution ? `Aktuális döntés: ${collision.resolution.action}` : "Nincs admin döntés.",
  ));

  const actions = document.createElement("div");
  actions.className = "collision-actions";
  actions.append(
    collisionButton("Összevonás megerősítése", collision.case_key, "confirm_merge"),
    collisionButton("Eredeti összevonás visszaállítása", collision.case_key, "merge"),
  );
  for (const athleteId of collision.athlete_ids) {
    actions.append(collisionButton(`VL ${athleteId} különválasztása`, collision.case_key, "split", { athlete_id: athleteId }));
  }
  if (collision.reasons.includes("same_event_collision")) {
    for (const row of registrationRows(registration).filter((source) => source.entry_id != null)) {
      actions.append(collisionButton(
        `${row.season}: VL ${row.athlete_id} eredménye számítson`,
        collision.case_key,
        "select_result",
        { entry_id: row.entry_id },
      ));
    }
  }
  card.append(actions);
  return card;
}

function renderCandidates() {
  const visible = issueFilter.value
    ? athletes.filter((athlete) => athlete.issue_type === issueFilter.value)
    : athletes;
  candidates.replaceChildren(...visible.map(renderCandidate));
  status.textContent = athletes.length
    ? `${visible.length} / ${athletes.length} sportoló megjelenítve.`
    : "Nincs több forráskategóriával rendelkező sportoló.";
}

async function loadCandidates() {
  try {
    const response = await fetch("/api/admin/year-categories?year=2026", { cache: "no-store" });
    if (!response.ok) throw new Error("A kategóriaütközéseket nem sikerült betölteni.");
    const data = await response.json();
    athletes = data.athletes;
    renderCandidates();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Betöltési hiba.";
  }
}

async function loadMultiRegistrations() {
  try {
    const response = await fetch("/api/admin/multi-registrations?year=2026", { cache: "no-store" });
    if (!response.ok) throw new Error("A többszörös regisztrációkat nem sikerült betölteni.");
    const data = await response.json();
    multiRegistrationCandidates.replaceChildren(...data.registrations.map(renderMultiRegistration));
    multiRegistrationStatus.textContent = data.registrations.length
      ? `${data.registrations.length} sportoló több Vertical-Life ID-val.`
      : "Nincs többszörös regisztráció.";
  } catch (error) {
    multiRegistrationStatus.textContent = error instanceof Error ? error.message : "Betöltési hiba.";
  }
}

function renderCollisions() {
  const visible = collisions.filter((collision) => {
    if (collisionReasonFilter.value === "to_decide") return !collision.resolution;
    return !collisionReasonFilter.value || collision.reasons.includes(collisionReasonFilter.value);
  });
  collisionCandidates.replaceChildren(...visible.map(renderCollision));
  const unresolved = visible.filter((collision) => !collision.resolution).length;
  collisionStatus.textContent = `${visible.length} / ${collisions.length} kockázatos összevonás, ${unresolved} döntés nélkül.`;
}

async function loadCollisions() {
  try {
    const response = await fetch("/api/admin/collisions?year=2026", { cache: "no-store" });
    if (!response.ok) throw new Error("Az ütközéseket nem sikerült betölteni.");
    const data = await response.json();
    collisions = data.collisions;
    renderCollisions();
  } catch (error) {
    collisionStatus.textContent = error instanceof Error ? error.message : "Betöltési hiba.";
  }
}

function activateTab() {
  const active = ["#multi-registration", "#collision"].includes(location.hash)
    ? location.hash.slice(1)
    : "categories";
  for (const tab of tabs) {
    const selected = tab.id === `${active}-tab`;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== `${active}-panel`;
}

issueFilter.addEventListener("change", renderCandidates);
collisionReasonFilter.addEventListener("change", renderCollisions);
window.addEventListener("hashchange", activateTab);
activateTab();
loadCandidates();
loadMultiRegistrations();
loadCollisions();
