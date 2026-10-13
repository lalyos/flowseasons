import { filterByCategory } from "./category-filter.js";
import { resolveShowIds } from "./show-ids.js";

const seasonNames = {
  Total: "Total",
  Spring: "Tavasz",
  Summer: "Nyár",
  Autumn: "Ősz",
  Winter: "Tél",
};
const seasonOrder = ["Total", "Spring", "Summer", "Autumn", "Winter"];
const message = document.querySelector("#message");
const retry = document.querySelector("#retry");
const results = document.querySelector("#results");
const eventsNav = document.querySelector("#events");
const eventTitle = document.querySelector("#event-title");
const eventStatus = document.querySelector("#event-status");
const rows = document.querySelector("#result-rows");
const categoryFilter = document.querySelector("#category-filter");
const emptyResults = document.querySelector("#empty-results");
const tableWrap = document.querySelector(".table-wrap");
let selectedTab;
let tabButtons = new Map();

const showIds = resolveShowIds(
  window.location,
  document.cookie,
  (value) => { document.cookie = value; },
  (url) => window.history.replaceState(null, "", url),
);

function showEvent(event, buttons) {
  selectedTab = event;
  tabButtons = buttons;
  eventTitle.textContent = seasonNames[event.season] || event.season;
  eventStatus.hidden = event.status !== "active";
  rows.replaceChildren();

  const visibleResults = filterByCategory(event.results, categoryFilter.value);
  emptyResults.hidden = visibleResults.length > 0;
  tableWrap.hidden = visibleResults.length === 0;
  for (const result of visibleResults) {
    const row = document.createElement("tr");
    for (const [field, label, value] of [
      ["rank", "Helyezés", result.rank],
      ["name", "Név", result.name],
      ["category", "Kategória", result.category],
      ["score", "Pontszám", String(result.score)],
    ]) {
      const cell = document.createElement("td");
      cell.dataset.field = field;
      cell.dataset.label = label;
      cell.textContent = value;
      row.append(cell);
    }
    if (showIds) {
      const identifiers = document.createElement("small");
      identifiers.className = "identity-ids";
      identifiers.textContent = [
        ...(result.athlete_id == null ? [] : [`Vertical-Life ID: ${result.athlete_id}`]),
        `Flow ID: ${result.flow_id ?? "—"}`,
      ].join(" · ");
      row.querySelector('[data-field="name"]').append(identifiers);
    }
    rows.append(row);
  }

  for (const [season, button] of buttons) {
    button.setAttribute("aria-pressed", String(season === event.season));
  }
}

async function loadResults() {
  retry.hidden = true;
  results.hidden = true;
  message.hidden = false;
  message.textContent = "Eredmények betöltése…";

  try {
    const response = await fetch("/api/results?year=2026", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const tabs = [
      { season: "Total", results: data.total.results },
      ...data.events,
    ].sort((a, b) => seasonOrder.indexOf(a.season) - seasonOrder.indexOf(b.season));
    const buttons = new Map();

    eventsNav.replaceChildren();
    eventsNav.hidden = tabs.length < 2;
    if (tabs.length > 1) {
      for (const event of tabs) {
        const button = document.createElement("button");
        button.className = "event-button";
        button.type = "button";
        button.textContent = `${seasonNames[event.season] || event.season}${event.status === "active" ? " · Aktív" : ""}`;
        button.addEventListener("click", () => showEvent(event, buttons));
        buttons.set(event.season, button);
        eventsNav.append(button);
      }
    }

    showEvent(tabs[0], buttons);
    results.hidden = false;
    message.hidden = true;
  } catch {
    message.textContent = "Az eredményeket nem sikerült betölteni.";
    retry.hidden = false;
  }
}

categoryFilter.addEventListener("change", () => {
  if (selectedTab) showEvent(selectedTab, tabButtons);
});

retry.addEventListener("click", loadResults);
loadResults();
