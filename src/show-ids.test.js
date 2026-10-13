import assert from "node:assert/strict";
import test from "node:test";
import { resolveShowIds } from "../public/show-ids.js";

test("showid query sets the cookie and removes itself from the URL", () => {
  const cookies = [];
  const urls = [];
  const visible = resolveShowIds(
    new URL("https://example.test/results?tab=Autumn&showid=true#rows"),
    "",
    (cookie) => cookies.push(cookie),
    (url) => urls.push(url),
  );

  assert.equal(visible, true);
  assert.deepEqual(cookies, ["showid=true; Max-Age=2592000; Path=/; SameSite=Lax; Secure"]);
  assert.deepEqual(urls, ["/results?tab=Autumn#rows"]);
});

test("showid=false overrides a saved preference; absent query uses the cookie", () => {
  const cookies = [];
  const urls = [];
  assert.equal(resolveShowIds(
    new URL("http://example.test/?showid=false"),
    "showid=true",
    (cookie) => cookies.push(cookie),
    (url) => urls.push(url),
  ), false);
  assert.equal(cookies[0], "showid=false; Max-Age=2592000; Path=/; SameSite=Lax");
  assert.equal(resolveShowIds(
    new URL("https://example.test/"),
    "other=value; showid=true",
    () => assert.fail("must not rewrite cookie without a query override"),
    () => assert.fail("must not rewrite URL without a query override"),
  ), true);
});
