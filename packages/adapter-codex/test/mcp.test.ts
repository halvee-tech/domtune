import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { ChangeSetStore } from "@domtune/transport";
import { compactDomTuneChangeSetForAgent, formatDomTuneChangeSetForAgent, waitForDomTuneChangeSet } from "../src/mcp.js";

test("waits for and claims a browser ChangeSet", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-wait-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const waiting = waitForDomTuneChangeSet(store, "session-wait", 1500);

  await delay(20);
  const created = await store.create({
    sessionId: "session-wait",
    origin: "browser-overlay",
    prompt: "Clarify this section.",
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 1280, height: 800 },
    target: { selector: "main > section", label: "Section" },
    changes: []
  });

  const received = await waiting;
  assert.equal(received?.id, created.id);
  assert.ok(received?.conversationClaimedAt);
  assert.equal(received?.conversationNotifiedAt, undefined);
});

test("returns after a bounded wait when no ChangeSet arrives", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-wait-timeout-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  assert.equal(await waitForDomTuneChangeSet(store, "missing-session", 10), undefined);
});

test("formats the complete ChangeSet and user prompt for direct agent use", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-inline-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const item = await store.create({
    sessionId: "session-inline",
    origin: "browser-overlay",
    prompt: "啊哈",
    workspace: directory,
    pageUrl: "http://localhost/page?domTuneSession=session-inline&tab=overview",
    pageTitle: "Example page",
    viewport: { width: 1280, height: 800 },
    target: {
      id: "session-inline_window-identifier_heading",
      selector: "main > h2",
      label: "Heading",
      prompt: "啊哈",
      context: { tagName: "h2", html: "<h2 class=\"title\">Example</h2>" }
    },
    targets: [{
      id: "session-inline_window-identifier_heading",
      selector: "main > h2",
      label: "Heading",
      prompt: "啊哈",
      context: { tagName: "h2", html: "<h2 class=\"title\">Example</h2>", text: "Example", classNames: ["title"] }
    }],
    changes: [{ targetId: "session-inline_window-identifier_heading", property: "color", before: "rgb(0, 0, 0)", after: "#112233" }]
  });

  const payload = compactDomTuneChangeSetForAgent(item);
  assert.equal(payload.pageUrl, "http://localhost/page?tab=overview");
  assert.equal(payload.targets[0].id, "t1");
  assert.deepEqual(payload.targets[0].context, { html: "<h2 class=\"title\">Example</h2>" });
  assert.equal(payload.changes[0].targetId, "t1");
  assert.ok(!("sessionId" in payload));
  assert.ok(!("target" in payload));
  assert.ok(JSON.stringify(payload).length < JSON.stringify(item).length * 0.8);

  const message = formatDomTuneChangeSetForAgent(item);
  assert.match(message, /User instructions: 啊哈/);
  assert.match(message, /"pageUrl":"http:\/\/localhost\/page\?tab=overview"/);
  assert.match(message, /"selector":"main > h2"/);
  assert.match(message, /<h2 class=\\"title\\">Example<\/h2>/);
  assert.match(message, /do not fetch it again/);
});
