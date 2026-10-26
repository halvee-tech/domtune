import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertTargetReachable, buildChromiumArgs, chromiumCandidates, cleanupStaleBrowserSessions, cssEscapeIdentifier, findUniqueClassSource, isLocalDevelopmentUrl, resolveSourceMapPosition, validateBrowserSessionInput } from "../src/index.js";

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

test("maps generated CSS positions to workspace-local original sources", () => {
  const workspace = "/workspace";
  const mapped = resolveSourceMapPosition({
    version: 3,
    file: "generated.css",
    names: [],
    sources: ["/workspace/src/card.module.css"],
    sourcesContent: [".card { border-radius: 12px; }"],
    mappings: "AAAA"
  }, { line: 1, column: 0 }, workspace);

  assert.deepEqual(mapped, {
    file: "src/card.module.css",
    line: 1,
    method: "source-map",
    confidence: "exact"
  });
  assert.equal(resolveSourceMapPosition({
    version: 3,
    file: "generated.css",
    names: [],
    sources: ["/outside/card.css"],
    mappings: "AAAA"
  }, { line: 1, column: 0 }, workspace), undefined);
  assert.equal(resolveSourceMapPosition({
    version: 3,
    file: "generated.css",
    names: [],
    sources: ["/workspace/node_modules/tailwindcss/index.css"],
    mappings: "AAAA"
  }, { line: 1, column: 0 }, workspace), undefined);
});

test("escapes utility class names as CSS identifiers", () => {
  assert.equal(cssEscapeIdentifier("rounded-[37px]"), "rounded-\\[37px\\]");
  assert.equal(cssEscapeIdentifier("hover:bg-emerald-500/50"), "hover\\:bg-emerald-500\\/50");
});

test("finds only a unique static utility class occurrence", async () => {
  const root = await mkdtemp(join(tmpdir(), "domtune-utility-test-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "dist"), { recursive: true });
  await writeFile(join(root, "src", "card.tsx"), "export const card = <article className=\"p-6 rounded-[37px]\" />;\n");
  await writeFile(join(root, "dist", "ignored.js"), "const ignored = 'rounded-[37px]';\n");

  assert.deepEqual(await findUniqueClassSource(root, "rounded-[37px]"), { file: "src/card.tsx", line: 1 });
  await writeFile(join(root, "src", "duplicate.vue"), "<div class=\"rounded-[37px]\" />\n");
  assert.equal(await findUniqueClassSource(root, "rounded-[37px]"), undefined);
  await rm(root, { recursive: true, force: true });
});

test("checks that the target development server is reachable", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await assertTargetReachable(`http://127.0.0.1:${address.port}/`);
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await assert.rejects(assertTargetReachable(`http://127.0.0.1:${address.port}/`, 100), /Start the development server/);
});

test("cleans dead sessions and expired incomplete profiles", async () => {
  const root = await mkdtemp(join(tmpdir(), "domtune-browser-test-"));
  const deadRoot = join(root, "dt_dead");
  const incompleteRoot = join(root, "dt_incomplete");
  await mkdir(join(deadRoot, "profile"), { recursive: true });
  await writeFile(join(deadRoot, "session.json"), JSON.stringify({
    sessionId: "dt_dead",
    browser: "Chromium",
    pid: 2_147_483_647,
    debugPort: 9,
    pageUrl: "http://127.0.0.1:4174/?domTuneSession=dt_dead",
    createdAt: new Date(0).toISOString(),
    targetUrl: "http://127.0.0.1:4174/",
    workspace: "/workspace"
  }));
  await mkdir(incompleteRoot, { recursive: true });
  await utimes(incompleteRoot, new Date(0), new Date(0));

  await cleanupStaleBrowserSessions(root, 100, Date.now());
  await assert.rejects(access(deadRoot));
  await assert.rejects(access(incompleteRoot));
  await rm(root, { recursive: true, force: true });
});
