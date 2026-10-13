import assert from "node:assert/strict";
import test from "node:test";
import { filterByCategory } from "../public/category-filter.js";

test("category filter recalculates competition ranks within the selected category", () => {
  const results = [
    { name: "Senior One", category: "Senior - Férfi", rank: 2 },
    { name: "Other Category", category: "Nyílt - Férfi", rank: 4 },
    { name: "Senior Two", category: "Senior - Férfi", rank: 7 },
    { name: "Senior Three", category: "Senior - Férfi", rank: 7 },
    { name: "Senior Four", category: "Senior - Férfi", rank: 11 },
  ];

  assert.deepEqual(filterByCategory(results, ""), results);
  assert.deepEqual(
    filterByCategory(results, "Senior - Férfi").map(({ name, rank }) => [name, rank]),
    [["Senior One", 1], ["Senior Two", 2], ["Senior Three", 2], ["Senior Four", 4]],
  );
  assert.deepEqual(filterByCategory(results, "Hobbi - Férfi"), []);
  assert.equal(results[0].rank, 2, "filtering must not mutate the source rank");
});
