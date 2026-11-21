import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.js";

const categoryRows = [
  {
    flow_id: "flow-16006", athlete_id: "16006", name: "NAGY Ambrus", season: "Spring", rank: 1,
    source_category: "Hobbi - Férfi", score_hundredths: 123085, year_category: "Hobbi - Férfi",
  },
  {
    flow_id: "flow-16006", athlete_id: "9332", name: "AMBRUS Nagy", season: "Autumn", rank: 1,
    source_category: "Nyílt - Férfi", score_hundredths: 96554, year_category: "Hobbi - Férfi",
  },
  {
    flow_id: "flow-20000", athlete_id: "20000", name: "One Category", season: "Autumn", rank: 2,
    source_category: "Senior - Női", score_hundredths: 50000, year_category: "Senior - Női",
  },
  {
    flow_id: "flow-30000", athlete_id: "30000", name: "Category Changer", season: "Spring", rank: 3,
    source_category: "Kezdő - Női", score_hundredths: 40000, year_category: "Nyílt - Női",
  },
  {
    flow_id: "flow-30000", athlete_id: "30000", name: "Category Changer", season: "Summer", rank: 4,
    source_category: "Nyílt - Női", score_hundredths: 60000, year_category: "Nyílt - Női",
  },
];

const multiRegistrationRows = [
  { flow_id: "flow-18495", athlete_id: "18495", name: "CSIGI Móni", season: "Spring", rank: 181, entry_id: 1, import_id: 1, score_hundredths: 1234, source_category: "Hobbi - Női" },
  { flow_id: "flow-18495", athlete_id: "20148", name: "CSIGI Móni", season: "Summer", rank: 163, entry_id: 2, import_id: 2, score_hundredths: 5678, source_category: "Nyílt - Női" },
  { flow_id: "flow-18495", athlete_id: "23774", name: null, season: null, rank: null, entry_id: null },
  { flow_id: "flow-18495", athlete_id: "23775", name: null, season: null, rank: null, entry_id: null },
];

const sourceFiles = [
  { r2_key: "spring.json", season: "Spring" },
  { r2_key: "summer.json", season: "Summer" },
  { r2_key: "autumn.json", season: "Autumn" },
];
const sourcePayloads = {
  "spring.json": {
    ranking: [{ athlete_id: 18495, name: "CSIGI Móni", custom_participant_fields: [{ value: "Hobbi - Női" }] }],
    startlist: [{ athlete_id: 18495, name: "CSIGI Móni" }],
  },
  "summer.json": {
    ranking: [{ athlete_id: 20148, name: "CSIGI Móni", custom_participant_fields: [{ value: "Nyílt - Női" }] }],
    startlist: [{ athlete_id: 20148, name: "CSIGI Móni" }],
  },
  "autumn.json": {
    ranking: [],
    startlist: [
      { athlete_id: 23774, name: "CSIGI Móni" },
      { athlete_id: 23775, name: "CSIGI Móni" },
    ],
  },
};

function mockEnv({ batch } = {}) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              sql,
              values,
              all: async () => ({
                results: sql.includes("WITH multi_registration")
                  ? multiRegistrationRows
                  : sql.includes("SELECT i.r2_key") ? sourceFiles : categoryRows,
              }),
            };
          },
        };
      },
      batch: batch || (async () => []),
    },
    RAW_RESULTS: {
      get: async (key) => sourcePayloads[key]
        ? { json: async () => sourcePayloads[key] }
        : null,
    },
  };
}

test("hidden admin route serves the unlinked admin asset", async () => {
  let assetUrl;
  const response = await worker.fetch(new Request("https://example.test/xxxadmin"), {
    ASSETS: {
      fetch: async (request) => {
        assetUrl = new URL(request.url).pathname;
        return new Response("admin page");
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(assetUrl, "/xxxadmin.html");
});

test("year-category admin lists only multi-category athletes with source evidence", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/admin/year-categories?year=2026"),
    mockEnv(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    year: 2026,
    athletes: [{
      flow_id: "flow-16006",
      name: "AMBRUS Nagy",
      year_category: "Hobbi - Férfi",
      issue_type: "identity_review",
      athlete_ids: ["16006", "9332"],
      categories: ["Hobbi - Férfi", "Nyílt - Férfi"],
      sources: [
        { season: "Spring", athlete_id: "16006", name: "NAGY Ambrus", category: "Hobbi - Férfi", rank: 1, score: 1230.85 },
        { season: "Autumn", athlete_id: "9332", name: "AMBRUS Nagy", category: "Nyílt - Férfi", rank: 1, score: 965.54 },
      ],
    }, {
      flow_id: "flow-30000",
      name: "Category Changer",
      year_category: "Nyílt - Női",
      issue_type: "category_change",
      athlete_ids: ["30000"],
      categories: ["Kezdő - Női", "Nyílt - Női"],
      sources: [
        { season: "Spring", athlete_id: "30000", name: "Category Changer", category: "Kezdő - Női", rank: 3, score: 400 },
        { season: "Summer", athlete_id: "30000", name: "Category Changer", category: "Nyílt - Női", rank: 4, score: 600 },
      ],
    }],
  });
});

test("multi-registration admin combines current results with ranking and startlist evidence", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/api/admin/multi-registrations?year=2026"),
    mockEnv(),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    year: 2026,
    registrations: [{
      flow_id: "flow-18495",
      name: "CSIGI Móni",
      athlete_ids: [
        { athlete_id: "18495", sources: [{ season: "Spring", name: "CSIGI Móni", rank: 181, score: 12.34, entry_id: 1, import_id: 1, category: "Hobbi - Női", presence: "ranking_and_startlist" }] },
        { athlete_id: "20148", sources: [{ season: "Summer", name: "CSIGI Móni", rank: 163, score: 56.78, entry_id: 2, import_id: 2, category: "Nyílt - Női", presence: "ranking_and_startlist" }] },
        { athlete_id: "23774", sources: [{ season: "Autumn", name: "CSIGI Móni", rank: null, score: null, entry_id: null, import_id: null, category: null, presence: "startlist" }] },
        { athlete_id: "23775", sources: [{ season: "Autumn", name: "CSIGI Móni", rank: null, score: null, entry_id: null, import_id: null, category: null, presence: "startlist" }] },
      ],
    }],
  });
});

test("admin rejects non-canonical categories without writing", async () => {
  let batchCalled = false;
  const response = await worker.fetch(new Request("https://example.test/api/admin/year-categories?year=2026", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flow_id: "flow-16006", category: "Imaginary category" }),
  }), mockEnv({ batch: async () => { batchCalled = true; return []; } }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "category is invalid" });
  assert.equal(batchCalled, false);
});

test("saving a final category atomically updates year_categories and Total", async () => {
  let statements;
  const response = await worker.fetch(new Request("https://example.test/api/admin/year-categories?year=2026", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flow_id: "flow-16006", category: "Senior - Női" }),
  }), mockEnv({ batch: async (batch) => { statements = batch; return []; } }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { flow_id: "flow-16006", category: "Senior - Női" });
  assert.equal(statements.length, 3);
  assert.match(statements[0].sql, /INSERT INTO year_categories/);
  assert.deepEqual(statements[0].values, [2026, "flow-16006", "Senior - Női"]);
  assert.match(statements[1].sql, /DELETE FROM total_standings/);
  assert.match(statements[2].sql, /INSERT INTO total_standings/);
  assert.doesNotMatch(statements[2].sql, /i\.status\s*=\s*'finished'/);
});
