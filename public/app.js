const summary = document.querySelector("#summary");
const checks = document.querySelector("#checks");

try {
  const response = await fetch("/api/health", { cache: "no-store" });
  const result = await response.json();
  summary.textContent = result.ok
    ? "Worker and bindings are reachable."
    : "One or more binding checks failed.";

  for (const [name, ok] of [["D1", result.d1], ["R2", result.r2]]) {
    const item = document.createElement("li");
    item.textContent = `${name}: ${ok ? "OK" : "unavailable"}`;
    checks.append(item);
  }
} catch {
  summary.textContent = "Could not reach the Worker.";
}
