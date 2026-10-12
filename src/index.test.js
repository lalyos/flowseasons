import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.js";

test("results BFF returns materialized Total and event rows with source names", async () => {
  const eventRows = [
    {
      season: "Spring", status: "finished", entry_id: 1, rank: 1, name: "NAGY Ambrus",
      source_category: "Nyílt - Férfi", score_hundredths: 123085,
    },
    {
      season: "Summer", status: "finished", entry_id: 2, rank: 1, name: "NAGY Ambrus",
      source_category: "Nyílt - Férfi", score_hundredths: 190086,
    },
    {
      season: "Autumn", status: "active", entry_id: 3, rank: 1, name: "AMBRUS Nagy",
      source_category: "Nyílt - Férfi", score_hundredths: 96554,
    },
  ];
  const totalRows = [
    { rank: 1, name: "AMBRUS Nagy", category: "Nyílt - Férfi", score_hundredths: 409725 },
  ];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...years) {
            assert.ok(years.every((year) => year === 2026));
            if (sql.includes("total_standings")) {
              assert.deepEqual(years, [2026, 2026]);
              assert.doesNotMatch(sql, /i\.status\s*=\s*'finished'/);
              return { all: async () => ({ results: totalRows }) };
            }
            assert.match(sql, /current_import_id/);
            return { all: async () => ({ results: eventRows }) };
          },
        };
      },
    },
  };

  const response = await worker.fetch(new Request("https://example.test/api/results?year=2026"), env);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(result, {
    year: 2026,
    total: {
      status: "active",
      results: [{ rank: 1, name: "AMBRUS Nagy", category: "Nyílt - Férfi", score: 4097.25 }],
    },
    events: [
      {
        season: "Spring",
        status: "finished",
        results: [{ rank: 1, name: "NAGY Ambrus", category: "Nyílt - Férfi", score: 1230.85 }],
      },
      {
        season: "Summer",
        status: "finished",
        results: [{ rank: 1, name: "NAGY Ambrus", category: "Nyílt - Férfi", score: 1900.86 }],
      },
      {
        season: "Autumn",
        status: "active",
        results: [{ rank: 1, name: "AMBRUS Nagy", category: "Nyílt - Férfi", score: 965.54 }],
      },
    ],
  });
});

test("results BFF rejects unsupported years without querying D1", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/results?year=2025"),
    { DB: { prepare() { throw new Error("should not query"); } } },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "year must be 2026" });
});
