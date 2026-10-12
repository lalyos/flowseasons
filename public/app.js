const summary = document.querySelector("#summary");
const output = document.querySelector("#results");

try {
  const response = await fetch("/api/results?year=2026", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Results request failed");

  const entryCount = data.events.reduce((total, event) => total + event.results.length, 0);
  summary.textContent = `Loaded ${entryCount} rows from ${data.events.length} event(s). Total is not included.`;
  output.textContent = JSON.stringify(data, null, 2);
} catch (error) {
  summary.textContent = error instanceof Error ? error.message : "Could not load results.";
}
