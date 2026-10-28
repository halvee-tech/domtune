import assert from "node:assert/strict";
import test from "node:test";
import { SessionBridgeStatus } from "../src/bridge-status.js";

test("tracks a live session bridge and expires a missing panel", () => {
  let now = 1_000;
  const status = new SessionBridgeStatus(6_000, () => now);

  assert.deepEqual(status.get("session-1"), { connected: false });
  assert.deepEqual(status.touch("session-1"), {
    connected: true,
    lastSeenAt: new Date(1_000).toISOString()
  });

  now += 5_999;
  assert.equal(status.get("session-1").connected, true);
  now += 2;
  assert.equal(status.get("session-1").connected, false);
});
