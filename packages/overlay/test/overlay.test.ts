import assert from "node:assert/strict";
import test from "node:test";
import { buildOverlayClient } from "../src/index.js";

test("the overlay is agent-neutral and emits the DOMTune session contract", () => {
  const client = buildOverlayClient({
    bridgeUrl: "http://127.0.0.1:49999",
    workspace: "/tmp/project"
  });

  assert.match(client, /domTuneSession/);
  assert.match(client, /data-domtune-source/);
  assert.match(client, /Send to Agent/);
  assert.doesNotMatch(client, /Send to Codex/);
});
