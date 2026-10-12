import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.js";

test("results BFF returns current event rows without Total", async () => {
  const dbRows = [
    {
      season: "Spring", status: "finished", entry_id: 1, rank: 1, name: "Example",
      source_category: "Kezdő -Férfi", score_hundredths: 123085,
    },
    {
      season: "Summer", status: "active", entry_id: null, rank: null, name: null,
      source_category: null, score_hundredths: null,
    },
  ];
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /current_import_id/);
        return {
          bind(year) {
            assert.equal(year, 2026);
            return { all: async () => ({ results: dbRows }) };
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
    events: [
      {
        season: "Spring",
        status: "finished",
        results: [{ rank: 1, name: "Example", category: "Kezdő - Férfi", score: 1230.85 }],
      },
      { season: "Summer", status: "active", results: [] },
    ],
  });
  assert.equal("total" in result, false);
});

test("results BFF rejects unsupported years without querying D1", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/results?year=2025"),
    { DB: { prepare() { throw new Error("should not query"); } } },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "year must be 2026" });
});
