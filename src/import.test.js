import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCategory, parseUpload, scoreToHundredths } from "./import.js";

test("category labels normalize accents, case, and whitespace", () => {
  assert.equal(normalizeCategory("Kezdő -Férfi"), "kezdo-ferfi");
  assert.equal(normalizeCategory("  KEZDŐ - FÉRFI  "), "kezdo-ferfi");
});

test("source scores round to integer hundredths; invalid values become zero", () => {
  assert.equal(scoreToHundredths("1230.85"), 123085);
  assert.equal(scoreToHundredths("1.005"), 101);
  assert.equal(scoreToHundredths("1.004"), 100);
  assert.equal(scoreToHundredths("not-a-score"), 0);
  assert.equal(scoreToHundredths(null), 0);
});

test("all supplied event files parse and use canonical display categories", async () => {
  for (const [path, season] of [
    ["flow-2026-1-results.json", "Spring"],
    ["flow-2026-2-results.json", "Summer"],
    ["flow-2026-3-results.json", "Autumn"],
  ]) {
    const source = JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
    const upload = parseUpload(source);
    assert.equal(upload.year, 2026);
    assert.equal(upload.season, season);
    assert.ok(upload.rows.length > 0);
    assert.ok(upload.rows.every((row) => [
      "Hobbi - Férfi", "Hobbi - Női", "Kezdő - Férfi", "Kezdő - Női",
      "Nyílt - Férfi", "Nyílt - Női", "Senior - Férfi", "Senior - Női",
    ].includes(row.category)));
    assert.equal(upload.rows[0].score_hundredths, scoreToHundredths(source.ranking[0].score));
    if (season === "Autumn") {
      const index = source.ranking.findIndex((row) => row.custom_participant_fields.some((field) => field.value === "Kezdő -Férfi"));
      assert.notEqual(index, -1);
      assert.equal(upload.rows[index].source_category, "Kezdő -Férfi");
      assert.equal(upload.rows[index].category, "Kezdő - Férfi");
    }
  }
});
