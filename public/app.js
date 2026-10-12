const seasonNames = {
  Spring: "Tavasz",
  Summer: "Nyár",
  Autumn: "Ősz",
  Winter: "Tél",
};
const seasonOrder = ["Spring", "Summer", "Autumn", "Winter"];
const message = document.querySelector("#message");
const retry = document.querySelector("#retry");
const results = document.querySelector("#results");
const eventsNav = document.querySelector("#events");
const eventTitle = document.querySelector("#event-title");
const eventStatus = document.querySelector("#event-status");
const rows = document.querySelector("#result-rows");

function showEvent(event, buttons) {
  eventTitle.textContent = seasonNames[event.season] || event.season;
  eventStatus.hidden = event.status !== "active";
  rows.replaceChildren();

  for (const result of event.results) {
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
    const events = [...data.events].sort(
      (a, b) => seasonOrder.indexOf(a.season) - seasonOrder.indexOf(b.season),
    );
    const buttons = new Map();

    eventsNav.replaceChildren();
    eventsNav.hidden = events.length < 2;
    if (events.length > 1) {
      for (const event of events) {
        const button = document.createElement("button");
        button.className = "event-button";
        button.type = "button";
        button.textContent = `${seasonNames[event.season] || event.season}${event.status === "active" ? " · Aktív" : ""}`;
        button.addEventListener("click", () => showEvent(event, buttons));
        buttons.set(event.season, button);
        eventsNav.append(button);
      }
    }

    showEvent(events[events.length - 1], buttons);
    results.hidden = false;
    message.hidden = true;
  } catch {
    message.textContent = "Az eredményeket nem sikerült betölteni.";
    retry.hidden = false;
  }
}

retry.addEventListener("click", loadResults);
loadResults();
