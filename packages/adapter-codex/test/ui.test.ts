import assert from "node:assert/strict";
import test from "node:test";
import { buildPanelHtml } from "../src/ui.js";

test("the embedded panel reads ChangeSets from the local service origin", () => {
  const html = buildPanelHtml("http://127.0.0.1:49999");

  assert.match(html, /const apiBaseUrl = .*http:\/\/127\.0\.0\.1:49999/);
  assert.match(html, /fetch\(apiBaseUrl \+ "\/api\/change-sets\?sessionId="/);
  assert.doesNotMatch(html, /fetch\("\/api\/change-sets\?sessionId="/);
  assert.match(html, /callMcpTool\("list_domtune_change_sets"/);
  assert.match(html, /callMcpTool\("save_domtune_change_set"/);
  assert.match(html, /item\?\.origin === "browser-overlay"/);
  assert.match(html, /callMcpTool\("mark_domtune_change_set_notified"/);
});
