import assert from "node:assert/strict";
import test from "node:test";
import { buildChromiumArgs, chromiumCandidates, isLocalDevelopmentUrl, validateBrowserSessionInput } from "../src/index.js";

test("recognizes loopback development targets", () => {
  assert.equal(isLocalDevelopmentUrl(new URL("http://127.0.0.1:4174/")), true);
  assert.equal(isLocalDevelopmentUrl(new URL("https://app.localhost/")), true);
  assert.equal(isLocalDevelopmentUrl(new URL("https://example.com/")), false);
});

test("requires an absolute workspace and local target", () => {
  assert.throws(() => validateBrowserSessionInput({
    sessionId: "dt_test",
    targetUrl: "http://127.0.0.1:4174/",
    bridgeUrl: "http://127.0.0.1:47822",
    workspace: "."
  }), /absolute workspace/);
  assert.throws(() => validateBrowserSessionInput({
    sessionId: "dt_test",
    targetUrl: "https://example.com/",
    bridgeUrl: "http://127.0.0.1:47822",
    workspace: "/workspace"
  }), /localhost development URLs/);
});

test("builds an isolated Chromium command line", () => {
  const args = buildChromiumArgs({ debugPort: 49123, profileRoot: "/tmp/domtune-profile", pageUrl: "http://127.0.0.1:4174/" });
  assert.ok(args.includes("--remote-debugging-port=49123"));
  assert.ok(args.includes("--user-data-dir=/tmp/domtune-profile"));
  assert.equal(args.at(-1), "http://127.0.0.1:4174/");
});

test("lists supported macOS Chromium browsers", () => {
  const candidates = chromiumCandidates("darwin", {});
  assert.ok(candidates.some((candidate) => candidate.includes("Google Chrome.app")));
  assert.ok(candidates.some((candidate) => candidate.includes("Microsoft Edge.app")));
});
