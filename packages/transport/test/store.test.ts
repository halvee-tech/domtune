import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ChangeSetStore } from "../src/store.js";

test("creates, lists, and reports a ChangeSet", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-1",
    origin: "browser-overlay",
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 375, height: 812 },
    target: {
      selector: ".card",
      label: "Card",
      source: { file: "styles.css", line: 1, method: "source-map", confidence: "exact" }
    },
    changes: [{ property: "padding", before: "24px", after: "20px" }]
  });

  assert.equal(created.schemaVersion, 1);
  assert.match(created.id, /^dt_/);
  assert.equal(created.target.source.method, "source-map");
  assert.equal((await store.list("session-1"))[0]?.status, "pending");

  const notified = await store.markConversationNotified(created.id);
  assert.ok(notified?.conversationNotifiedAt);

  const updated = await store.report(created.id, "applied", {
    summary: "Updated the card spacing.",
    changedFiles: ["styles.css"],
    verification: ["npm test"]
  });
  assert.equal(updated?.status, "applied");
  assert.equal((await store.get(created.id))?.result?.changedFiles[0], "styles.css");
});
