import assert from "node:assert/strict";
import test from "node:test";
import { buildOverlayClient } from "../src/index.js";

test("the overlay is agent-neutral and emits the DOMTune session contract", () => {
  const client = buildOverlayClient({
    bridgeUrl: "http://127.0.0.1:49999",
    workspace: "/tmp/project"
  });

  assert.match(client, /domTuneSession/);
  assert.match(client, /document\.querySelector\("domtune-overlay"\)/);
  assert.match(client, /DOMContentLoaded/);
  assert.match(client, /data-domtune-source/);
  assert.match(client, /data-vite-dev-id/);
  assert.match(client, /method: "css-rule"/);
  assert.match(client, /\/api\/source-map/);
  assert.match(client, /Mapping…/);
  assert.match(client, /controlled\?\.source/);
  assert.doesNotMatch(client, /unknown:1/);
  assert.doesNotThrow(() => new Function(client));
  assert.match(client, /Send to Agent/);
  assert.doesNotMatch(client, /Send to Codex/);
});
