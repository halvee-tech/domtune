import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { ChangeSetStore } from "../src/store.js";

test("creates, lists, and reports a ChangeSet", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-1",
    origin: "browser-overlay",
    impactAcknowledged: true,
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 375, height: 812 },
    target: {
      selector: ".card",
      label: "Card",
      source: { file: "Card.tsx", line: 8, method: "utility-class", confidence: "exact" }
    },
    changes: [
      {
        property: "padding",
        before: "24px",
        after: "20px",
        source: { file: "Card.vue", line: 6, method: "component-style", confidence: "exact" }
      },
      {
        property: "border-radius",
        before: "16px",
        after: "20px",
        source: { file: "Card.tsx", line: 8, method: "utility-class", confidence: "exact" }
      },
      {
        property: "background-color",
        before: "rgb(255, 255, 255)",
        after: "rgb(248, 248, 248)",
        source: { file: "Card.vue", line: 1, method: "component-runtime", confidence: "component" }
      },
      {
        property: "font-size",
        before: "16px",
        after: "18px",
        source: { file: "theme.ts", line: 3, method: "component-token", confidence: "exact", usageCount: 3, usageScope: "shared" }
      }
    ]
  });

  assert.equal(created.schemaVersion, 1);
  assert.equal(created.impactAcknowledged, true);
  assert.match(created.id, /^dt_/);
  assert.equal(created.target.source.method, "utility-class");
  assert.equal(created.changes[0]?.source?.file, "Card.vue");
  assert.equal(created.changes[0]?.source?.method, "component-style");
  assert.equal(created.changes[0]?.source?.confidence, "exact");
  assert.equal(created.changes[1]?.source?.method, "utility-class");
  assert.equal(created.changes[2]?.source?.confidence, "component");
  assert.equal(created.changes[3]?.source?.method, "component-token");
  assert.equal(created.changes[3]?.source?.usageCount, 3);
  assert.equal(created.changes[3]?.source?.usageScope, "shared");
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

test("persists a prompt-only request with selected-element context", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-prompt-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-prompt",
    origin: "browser-overlay",
    prompt: "Make this heading easier to scan without changing the surrounding section.",
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 1280, height: 800 },
    target: {
      selector: "main > section > h2",
      label: "h2",
      context: {
        tagName: "h2",
        html: "<h2 class=\"section-heading\">Capability and availability</h2>",
        text: "Capability and availability",
        classNames: ["section-heading"]
      }
    },
    changes: []
  });

  assert.equal(created.prompt, "Make this heading easier to scan without changing the surrounding section.");
  assert.equal(created.changes.length, 0);
  assert.equal(created.target.source, undefined);
  assert.equal((await store.list("session-prompt"))[0]?.target.context?.tagName, "h2");
  assert.match((await store.list("session-prompt"))[0]?.target.context?.html ?? "", /section-heading/);
});

test("persists an unresolved visual adjustment with compact HTML context", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-unresolved-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-unresolved",
    origin: "browser-overlay",
    workspace: directory,
    pageUrl: "http://localhost/desktop.html",
    viewport: { width: 1440, height: 900 },
    target: {
      id: "target-unresolved",
      selector: "section.ability-guide > article:nth-child(2)",
      label: "article",
      context: {
        tagName: "article",
        html: "<article class=\"ability-example\"><p>精简后的元素内容</p></article>",
        text: "精简后的元素内容",
        classNames: ["ability-example"]
      }
    },
    changes: [{
      targetId: "target-unresolved",
      property: "padding-left",
      before: "16px",
      after: "24px"
    }]
  });

  assert.equal(created.target.source, undefined);
  assert.equal(created.changes[0]?.source, undefined);
  assert.match(created.target.context?.html ?? "", /ability-example/);
});

test("persists a multi-element request with per-target intent and page context", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-multi-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-multi",
    origin: "browser-overlay",
    prompt: "Make the final card easier to notice.",
    workspace: directory,
    pageUrl: "http://localhost/pricing?plan=team#comparison",
    pageTitle: "Pricing · Acme",
    viewport: { width: 1440, height: 900 },
    target: {
      id: "target-d",
      selector: "#card-d",
      label: "Card D",
      prompt: "Make the final card easier to notice."
    },
    targets: [
      { id: "target-a", selector: "#card-a", label: "Card A" },
      { id: "target-b", selector: "#card-b", label: "Card B" },
      {
        id: "target-d",
        selector: "#card-d",
        label: "Card D",
        prompt: "Make the final card easier to notice."
      }
    ],
    changes: [
      { targetId: "target-a", property: "padding", before: "16px", after: "20px" },
      { targetId: "target-b", property: "font-size", before: "16px", after: "18px" }
    ]
  });

  assert.equal(created.targets?.length, 3);
  assert.deepEqual(created.targets?.map((target) => target.id), ["target-a", "target-b", "target-d"]);
  assert.deepEqual(created.changes.map((change) => change.targetId), ["target-a", "target-b"]);
  assert.equal(created.targets?.[2]?.prompt, "Make the final card easier to notice.");
  assert.equal(created.pageUrl, "http://localhost/pricing?plan=team#comparison");
  assert.equal(created.pageTitle, "Pricing · Acme");
});

test("claims a pending ChangeSet once for conversation continuation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-claim-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-claim",
    origin: "browser-overlay",
    prompt: "Make this easier to scan.",
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 1280, height: 800 },
    target: { selector: "main > h2", label: "Heading" },
    changes: []
  });

  const claimed = await store.claimPendingForConversation("session-claim");
  assert.equal(claimed?.id, created.id);
  assert.ok(claimed?.conversationClaimedAt);
  assert.equal(claimed?.conversationNotifiedAt, undefined);
  assert.equal(await store.claimPendingForConversation("session-claim"), undefined);

  const released = await store.releaseConversationClaim(created.id, claimed?.conversationClaimedAt);
  assert.equal(released?.conversationClaimedAt, undefined);
  const reclaimed = await store.claimPendingForConversation("session-claim");
  assert.equal(reclaimed?.id, created.id);
  const delivered = await store.markConversationNotified(created.id);
  assert.equal(delivered?.conversationClaimedAt, undefined);
  assert.ok(delivered?.conversationNotifiedAt);
});

test("reclaims a ChangeSet after an abandoned conversation lease expires", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-stale-claim-"));
  const filePath = join(directory, "change-sets.json");
  const store = new ChangeSetStore(filePath);
  const created = await store.create({
    sessionId: "session-stale",
    prompt: "Update this heading.",
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 1280, height: 800 },
    target: { selector: "h1", label: "Heading" },
    changes: []
  });
  assert.equal((await store.claimPendingForConversation("session-stale"))?.id, created.id);

  const items = JSON.parse(await readFile(filePath, "utf8"));
  items[0].conversationClaimedAt = "1970-01-01T00:00:00.000Z";
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");

  const reclaimed = await store.claimPendingForConversation("session-stale");
  assert.equal(reclaimed?.id, created.id);
  assert.notEqual(reclaimed?.conversationClaimedAt, "1970-01-01T00:00:00.000Z");
});

test("serializes competing conversation claims", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-claim-race-"));
  const store = new ChangeSetStore(join(directory, "change-sets.json"));
  const created = await store.create({
    sessionId: "session-race",
    origin: "browser-overlay",
    prompt: "Keep this request single-delivery.",
    workspace: directory,
    pageUrl: "http://localhost/demo",
    viewport: { width: 1280, height: 800 },
    target: { selector: "main", label: "Main" },
    changes: []
  });

  const claims = await Promise.all([
    store.claimPendingForConversation("session-race"),
    store.claimPendingForConversation("session-race")
  ]);
  assert.deepEqual(claims.filter(Boolean).map((item) => item?.id), [created.id]);
});

test("preserves every concurrent submission from multiple windows and claims them in send order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dom-tune-multi-window-"));
  const filePath = join(directory, "change-sets.json");
  const firstWindow = new ChangeSetStore(filePath);
  const secondWindow = new ChangeSetStore(filePath);
  const makeRequest = (prompt: string) => ({
    sessionId: "shared-session",
    origin: "browser-overlay" as const,
    prompt,
    workspace: directory,
    pageUrl: "http://localhost/demo?domTuneSession=shared-session",
    viewport: { width: 1280, height: 800 },
    target: { selector: "main", label: "Main" },
    changes: []
  });

  const first = firstWindow.create(makeRequest("Request from window A"));
  await delay(5);
  const second = secondWindow.create(makeRequest("Request from window B"));
  const created = await Promise.all([first, second]);

  const saved = await firstWindow.list("shared-session");
  assert.equal(saved.length, 2);
  assert.equal(new Set(saved.map((item) => item.id)).size, 2);
  assert.equal((await secondWindow.claimPendingForConversation("shared-session"))?.id, created[0].id);
  assert.equal((await firstWindow.claimPendingForConversation("shared-session"))?.id, created[1].id);
  assert.equal(await secondWindow.claimPendingForConversation("shared-session"), undefined);
});
