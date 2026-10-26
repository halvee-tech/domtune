import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { delimiter, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SourceMapConsumer, type RawSourceMap } from "source-map-js";
import WebSocket from "ws";
import { buildOverlayClient } from "@domtune/overlay";

export interface BrowserSessionInput {
  sessionId: string;
  targetUrl: string;
  bridgeUrl: string;
  workspace: string;
}

export interface BrowserSession {
  sessionId: string;
  browser: string;
  pid?: number;
  debugPort: number;
  pageUrl: string;
}

export interface BrowserSessionLauncher {
  open(input: BrowserSessionInput): Promise<BrowserSession>;
  close(sessionId: string): Promise<boolean>;
  closeAll(): Promise<number>;
  list(): Promise<BrowserSession[]>;
  resolveSource(input: BrowserSourceRequest): Promise<BrowserSourceResult>;
}

export interface BrowserSourceRequest {
  sessionId: string;
  targetToken: string;
  properties: string[];
  before?: Record<string, string>;
}

export interface BrowserSourceResult {
  source?: {
    file: string;
    line: number;
    method: "source-map" | "css-rule" | "utility-class";
    confidence: "exact";
  };
  reason?: "session-not-found" | "target-not-found" | "source-unavailable" | "ambiguous";
  candidateCount: number;
}

export interface ChromiumLauncherOptions {
  dataRoot: string;
  executable?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  launchTimeoutMs?: number;
  spawnProcess?: typeof spawn;
  staleProfileAgeMs?: number;
}

interface PersistedBrowserSession extends BrowserSession {
  createdAt: string;
  targetUrl: string;
  workspace: string;
}

interface ActiveBrowserSession {
  state: BrowserSession;
  sessionRoot: string;
  child: ChildProcess;
  client: CdpClient;
  input: BrowserSessionInput;
  styleSheets: Map<string, CdpStyleSheetHeader>;
  tailwindStyleSheets: Map<string, boolean>;
}

interface CdpStyleSheetHeader {
  styleSheetId: string;
  sourceURL?: string;
  sourceMapURL?: string;
  ownerNode?: number;
}

interface CdpSourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface CdpCssProperty {
  name: string;
  value?: string;
  disabled?: boolean;
  implicit?: boolean;
  parsedOk?: boolean;
}

interface CdpTarget {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface PendingCommand {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingCommand>();
  private readonly eventHandlers = new Map<string, Set<(params: unknown) => void>>();

  private constructor(private readonly socket: WebSocket) {
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string } };
      if (message.method) {
        for (const handler of this.eventHandlers.get(message.method) ?? []) handler(message.params);
        return;
      }
      if (!message.id) return;
      const command = this.pending.get(message.id);
      if (!command) return;
      this.pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message ?? "Chrome DevTools command failed."));
      else command.resolve(message.result);
    });
    socket.on("close", () => this.rejectPending(new Error("The controlled browser connection closed.")));
    socket.on("error", (error) => this.rejectPending(error));
  }

  static async connect(url: string): Promise<CdpClient> {
    return await new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.once("open", () => resolve(new CdpClient(socket)));
      socket.once("error", reject);
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return await result;
  }

  close(): void {
    this.socket.close();
  }

  on(method: string, handler: (params: unknown) => void): () => void {
    const handlers = this.eventHandlers.get(method) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(method, handlers);
    return () => handlers.delete(handler);
  }

  private rejectPending(error: Error): void {
    for (const command of this.pending.values()) command.reject(error);
    this.pending.clear();
  }
}

export class ChromiumBrowserSessionLauncher implements BrowserSessionLauncher {
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;
  private readonly spawnProcess: typeof spawn;
  private readonly sessionsRoot: string;
  private readonly staleProfileAgeMs: number;
  private readonly sessions = new Map<string, ActiveBrowserSession>();
  private preparePromise?: Promise<void>;

  constructor(private readonly options: ChromiumLauncherOptions) {
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.timeoutMs = options.launchTimeoutMs ?? 12_000;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.sessionsRoot = join(options.dataRoot, "browser-sessions");
    this.staleProfileAgeMs = options.staleProfileAgeMs ?? 7 * 24 * 60 * 60 * 1000;
  }

  async open(input: BrowserSessionInput): Promise<BrowserSession> {
    validateBrowserSessionInput(input);
    await this.prepare();
    await assertTargetReachable(input.targetUrl);
    await this.close(input.sessionId);
    const executable = this.options.executable ?? await findChromiumExecutable(this.platform, this.env);
    if (!executable) {
      throw new Error("DOMTune could not find Chrome, Chromium, Microsoft Edge, or Brave. Install a Chromium browser or set DOMTUNE_BROWSER_EXECUTABLE.");
    }

    const sessionRoot = join(this.sessionsRoot, input.sessionId);
    const profileRoot = join(sessionRoot, "profile");
    await mkdir(profileRoot, { recursive: true });
    const pageUrl = withSessionId(input.targetUrl, input.sessionId);
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.launchOnce(input, executable, sessionRoot, profileRoot, pageUrl);
      } catch (error) {
        lastError = error;
        if (attempt === 0) await delay(150);
      }
    }
    throw lastError;
  }

  async close(sessionId: string): Promise<boolean> {
    await this.prepare();
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    session.client.close();
    await stopChild(session.child);
    await removeSessionRoot(session.sessionRoot);
    return true;
  }

  async closeAll(): Promise<number> {
    await this.prepare();
    const sessionIds = [...this.sessions.keys()];
    await Promise.all(sessionIds.map((sessionId) => this.close(sessionId)));
    return sessionIds.length;
  }

  async list(): Promise<BrowserSession[]> {
    await this.prepare();
    return [...this.sessions.values()].map((session) => ({ ...session.state }));
  }

  async resolveSource(input: BrowserSourceRequest): Promise<BrowserSourceResult> {
    await this.prepare();
    const session = this.sessions.get(input.sessionId);
    if (!session) return { reason: "session-not-found", candidateCount: 0 };
    if (!/^[A-Za-z0-9_-]+$/.test(input.targetToken)) return { reason: "target-not-found", candidateCount: 0 };

    const documentResult = await session.client.send("DOM.getDocument", { depth: 0, pierce: true }) as { root: { nodeId: number } };
    const queryResult = await session.client.send("DOM.querySelector", {
      nodeId: documentResult.root.nodeId,
      selector: `[data-domtune-target="${input.targetToken}"]`
    }) as { nodeId: number };
    if (!queryResult.nodeId) return { reason: "target-not-found", candidateCount: 0 };

    const described = await session.client.send("DOM.describeNode", { nodeId: queryResult.nodeId, depth: 0 }) as { node: { attributes?: string[] } };
    const classNames = attributeValue(described.node.attributes ?? [], "class")?.split(/\s+/).filter(Boolean) ?? [];

    const matched = await session.client.send("CSS.getMatchedStylesForNode", { nodeId: queryResult.nodeId }) as {
      matchedCSSRules?: Array<{
        rule: {
          styleSheetId?: string;
          selectorList?: { text?: string; range?: CdpSourceRange };
          style?: { range?: CdpSourceRange; cssProperties?: CdpCssProperty[] };
        };
      }>;
    };
    const candidates = new Map<string, BrowserSourceResult["source"]>();
    for (const match of matched.matchedCSSRules ?? []) {
      const rule = match.rule;
      if (!rule.styleSheetId || !ruleDeclaresAny(rule.style?.cssProperties ?? [], input.properties)) continue;
      if (!await ruleMatchesCapturedValues(session.client, queryResult.nodeId, rule.style?.cssProperties ?? [], input)) continue;
      const header = session.styleSheets.get(rule.styleSheetId);
      if (!header) continue;
      const range = rule.selectorList?.range ?? rule.style?.range;
      if (!range) continue;
      const source = await resolveCdpRuleSource(session, header, range);
      if (!source && await isTailwindStyleSheet(session, header)) {
        const utilityClass = utilityClassForSelector(rule.selectorList?.text ?? "", classNames);
        const utilitySource = utilityClass ? await findUniqueClassSource(session.input.workspace, utilityClass) : undefined;
        if (utilitySource) {
          const candidate = { ...utilitySource, method: "utility-class" as const, confidence: "exact" as const };
          candidates.set(`${candidate.file}:${candidate.line}:${utilityClass}`, candidate);
          continue;
        }
      }
      if (!source) continue;
      const key = `${source.file}:${source.line}:${rule.selectorList?.text ?? ""}`;
      candidates.set(key, source);
    }

    if (candidates.size === 1) return { source: [...candidates.values()][0], candidateCount: 1 };
    if (candidates.size > 1) return { reason: "ambiguous", candidateCount: candidates.size };
    return { reason: "source-unavailable", candidateCount: 0 };
  }

  terminateAll(): void {
    for (const session of this.sessions.values()) {
      session.client.close();
      if (session.child.exitCode === null) session.child.kill();
    }
    this.sessions.clear();
  }

  private async prepare(): Promise<void> {
    this.preparePromise ??= cleanupStaleBrowserSessions(this.sessionsRoot, this.staleProfileAgeMs);
    await this.preparePromise;
  }

  private async launchOnce(input: BrowserSessionInput, executable: string, sessionRoot: string, profileRoot: string, pageUrl: string): Promise<BrowserSession> {
    await mkdir(profileRoot, { recursive: true });
    const debugPort = await reserveLoopbackPort();
    const args = buildChromiumArgs({ debugPort, profileRoot, pageUrl });
    const child = this.spawnProcess(executable, args, {
      detached: false,
      stdio: "ignore",
      env: this.env
    });
    let spawnError: Error | undefined;
    let client: CdpClient | undefined;
    child.once("error", (error) => { spawnError = error; });
    child.unref();

    try {
      const target = await waitForPageTarget(debugPort, pageUrl, this.timeoutMs, child, () => spawnError);
      client = await CdpClient.connect(target.webSocketDebuggerUrl!);
      const styleSheets = new Map<string, CdpStyleSheetHeader>();
      const tailwindStyleSheets = new Map<string, boolean>();
      client.on("CSS.styleSheetAdded", (params) => {
        const header = (params as { header: CdpStyleSheetHeader }).header;
        styleSheets.set(header.styleSheetId, header);
      });
      client.on("CSS.styleSheetRemoved", (params) => {
        const styleSheetId = (params as { styleSheetId: string }).styleSheetId;
        styleSheets.delete(styleSheetId);
        tailwindStyleSheets.delete(styleSheetId);
      });
      const source = buildOverlayClient({
        bridgeUrl: input.bridgeUrl,
        workspace: input.workspace,
        sessionId: input.sessionId,
        targetOrigin: new URL(input.targetUrl).origin
      });
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("DOM.enable");
      await client.send("CSS.enable");
      await client.send("Page.addScriptToEvaluateOnNewDocument", { source });
      const evaluation = await client.send("Runtime.evaluate", { expression: source, awaitPromise: true }) as { exceptionDetails?: { text?: string; exception?: { description?: string } } };
      if (evaluation.exceptionDetails) {
        throw new Error(`DOMTune overlay injection failed: ${evaluation.exceptionDetails.exception?.description ?? evaluation.exceptionDetails.text ?? "unknown page error"}`);
      }
      const state = { sessionId: input.sessionId, browser: browserName(executable), pid: child.pid, debugPort, pageUrl };
      const persisted: PersistedBrowserSession = {
        ...state,
        createdAt: new Date().toISOString(),
        targetUrl: input.targetUrl,
        workspace: input.workspace
      };
      await writeFile(join(sessionRoot, "session.json"), JSON.stringify(persisted, null, 2), "utf8");
      const active = { state, sessionRoot, child, client, input, styleSheets, tailwindStyleSheets };
      this.sessions.set(input.sessionId, active);
      child.once("exit", () => {
        if (this.sessions.get(input.sessionId) !== active) return;
        this.sessions.delete(input.sessionId);
        client?.close();
        void removeSessionRoot(sessionRoot);
      });
      return state;
    } catch (error) {
      client?.close();
      await stopChild(child);
      await removeSessionRoot(sessionRoot);
      throw error;
    }
  }
}

async function ruleMatchesCapturedValues(client: CdpClient, nodeId: number, properties: CdpCssProperty[], input: BrowserSourceRequest): Promise<boolean> {
  if (!input.before) return true;
  const declarations = properties.flatMap((declaration) => input.properties.flatMap((requested) => {
    if (declaration.name === requested || (requested === "background-color" && declaration.name === "background")) return [{ declaration, requested }];
    return [];
  }));
  if (!declarations.length) return false;
  try {
    for (const requested of new Set(declarations.map((item) => item.requested))) {
      const before = input.before[requested];
      if (!before) continue;
      let matches = false;
      for (const { declaration } of declarations.filter((item) => item.requested === requested)) {
        if (!declaration.value) continue;
        const propertyName = requested === "font-size" || requested === "background-color" ? requested : undefined;
        const result = await client.send("CSS.resolveValues", {
          values: [declaration.value],
          nodeId,
          ...(propertyName ? { propertyName } : {})
        }) as { results: string[] };
        if (normalizeCssValue(result.results[0] ?? declaration.value) === normalizeCssValue(before)) {
          matches = true;
          break;
        }
      }
      if (!matches) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function normalizeCssValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
}

async function isTailwindStyleSheet(session: ActiveBrowserSession, header: CdpStyleSheetHeader): Promise<boolean> {
  const cached = session.tailwindStyleSheets.get(header.styleSheetId);
  if (cached !== undefined) return cached;
  const ownerFile = await styleSheetOwnerFile(session.client, header);
  const file = ownerFile ? toWorkspaceFile(ownerFile, session.input.workspace) : undefined;
  let isTailwind = false;
  if (file) {
    try {
      isTailwind = /@import\s+["']tailwindcss(?:\/[^"']*)?["']/.test(await readFile(resolve(session.input.workspace, file), "utf8"));
    } catch {
      isTailwind = false;
    }
  }
  session.tailwindStyleSheets.set(header.styleSheetId, isTailwind);
  return isTailwind;
}

function utilityClassForSelector(selector: string, classNames: string[]): string | undefined {
  const matches = classNames.filter((className) => selector.includes(`.${cssEscapeIdentifier(className)}`));
  return matches.length === 1 ? matches[0] : undefined;
}

export function cssEscapeIdentifier(value: string): string {
  const string = String(value);
  let result = "";
  for (let index = 0; index < string.length; index += 1) {
    const code = string.charCodeAt(index);
    if (code === 0) { result += "\uFFFD"; continue; }
    if ((code >= 1 && code <= 31) || code === 127 || (index === 0 && code >= 48 && code <= 57) || (index === 1 && code >= 48 && code <= 57 && string.charCodeAt(0) === 45)) {
      result += `\\${code.toString(16)} `;
      continue;
    }
    if (index === 0 && code === 45 && string.length === 1) { result += "\\-"; continue; }
    if (code >= 128 || code === 45 || code === 95 || code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122) result += string[index];
    else result += `\\${string[index]}`;
  }
  return result;
}

const sourceExtensions = new Set([".html", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro"]);
const ignoredSourceDirectories = new Set([".git", ".next", ".nuxt", ".output", "build", "coverage", "dist", "node_modules"]);

export async function findUniqueClassSource(workspace: string, className: string): Promise<{ file: string; line: number } | undefined> {
  const matches: Array<{ file: string; line: number }> = [];
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp("(^|[\\s\"'`])" + escaped + "(?=$|[\\s\"'`])", "gm");
  async function visit(directory: string): Promise<void> {
    if (matches.length > 1) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (matches.length > 1) return;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredSourceDirectories.has(entry.name)) await visit(absolute);
        continue;
      }
      if (!entry.isFile() || !sourceExtensions.has(extname(entry.name))) continue;
      let text: string;
      try {
        if ((await stat(absolute)).size > 1_000_000) continue;
        text = await readFile(absolute, "utf8");
      } catch { continue; }
      pattern.lastIndex = 0;
      for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
        const tokenOffset = match.index + match[1].length;
        matches.push({
          file: relative(workspace, absolute).replaceAll("\\", "/"),
          line: text.slice(0, tokenOffset).split("\n").length
        });
        if (matches.length > 1) return;
      }
    }
  }
  await visit(resolve(workspace));
  return matches.length === 1 ? matches[0] : undefined;
}

function attributeValue(attributes: string[], name: string): string | undefined {
  for (let index = 0; index < attributes.length; index += 2) if (attributes[index] === name) return attributes[index + 1];
  return undefined;
}

function ruleDeclaresAny(properties: CdpCssProperty[], requested: string[]): boolean {
  return properties.some((property) => {
    if (property.disabled || property.parsedOk === false || !property.value) return false;
    if (requested.includes(property.name)) return true;
    return requested.includes("background-color") && property.name === "background";
  });
}

async function resolveCdpRuleSource(session: ActiveBrowserSession, header: CdpStyleSheetHeader, range: CdpSourceRange): Promise<BrowserSourceResult["source"] | undefined> {
  if (header.sourceMapURL) {
    const rawMap = await loadSourceMap(header.sourceMapURL, header.sourceURL || session.state.pageUrl);
    if (rawMap) {
      const source = resolveSourceMapPosition(rawMap, {
        line: range.startLine + 1,
        column: range.startColumn
      }, session.input.workspace);
      if (source) {
        try {
          await access(resolve(session.input.workspace, source.file));
          return source;
        } catch {
          // A source map cannot establish an exact target when its original file is absent.
        }
      }
    }
  }

  const ownerFile = await styleSheetOwnerFile(session.client, header);
  const file = ownerFile ? toWorkspaceFile(ownerFile, session.input.workspace) : undefined;
  if (!file) return undefined;
  try {
    const [{ text }, sourceText] = await Promise.all([
      session.client.send("CSS.getStyleSheetText", { styleSheetId: header.styleSheetId }) as Promise<{ text: string }>,
      readFile(resolve(session.input.workspace, file), "utf8")
    ]);
    if (normalizeNewlines(text) !== normalizeNewlines(sourceText)) return undefined;
    return { file, line: range.startLine + 1, method: "css-rule", confidence: "exact" };
  } catch {
    return undefined;
  }
}

export function resolveSourceMapPosition(
  rawMap: RawSourceMap,
  generated: { line: number; column: number },
  workspace: string
): BrowserSourceResult["source"] | undefined {
  try {
    const consumer = new SourceMapConsumer(rawMap);
    const original = consumer.originalPositionFor(generated);
    const file = original.source ? toWorkspaceFile(original.source, workspace) : undefined;
    if (!file || !original.line) return undefined;
    return { file, line: original.line, method: "source-map", confidence: "exact" };
  } catch {
    return undefined;
  }
}

async function loadSourceMap(sourceMapUrl: string, baseUrl: string): Promise<RawSourceMap | undefined> {
  try {
    if (sourceMapUrl.startsWith("data:")) {
      const comma = sourceMapUrl.indexOf(",");
      if (comma < 0) return undefined;
      const metadata = sourceMapUrl.slice(0, comma);
      const payload = sourceMapUrl.slice(comma + 1);
      const json = metadata.includes(";base64") ? Buffer.from(payload, "base64").toString("utf8") : decodeURIComponent(payload);
      return JSON.parse(json) as RawSourceMap;
    }
    const response = await fetch(new URL(sourceMapUrl, baseUrl));
    if (!response.ok) return undefined;
    return await response.json() as RawSourceMap;
  } catch {
    return undefined;
  }
}

async function styleSheetOwnerFile(client: CdpClient, header: CdpStyleSheetHeader): Promise<string | undefined> {
  if (!header.ownerNode) return undefined;
  try {
    const result = await client.send("DOM.describeNode", { backendNodeId: header.ownerNode, depth: 0 }) as { node: { attributes?: string[] } };
    const attributes = result.node.attributes ?? [];
    for (let index = 0; index < attributes.length; index += 2) {
      if (attributes[index] === "data-vite-dev-id" || attributes[index] === "data-domtune-source-file") return attributes[index + 1];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function toWorkspaceFile(value: string, workspace: string): string | undefined {
  let candidate = decodeURIComponent(value).replaceAll("\\", "/");
  if (candidate.startsWith("file://")) {
    try { candidate = fileURLToPath(candidate); } catch { return undefined; }
  }
  if (candidate.startsWith("/@fs/")) candidate = candidate.slice(4);
  if (/^[a-z]+:\/\//i.test(candidate)) return undefined;
  const absolute = isAbsolute(candidate) ? candidate : resolve(workspace, candidate);
  const relativePath = relative(resolve(workspace), resolve(absolute));
  if (!relativePath) return ".";
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return undefined;
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.split("/").includes("node_modules")) return undefined;
  return normalized;
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n").trim();
}

export function validateBrowserSessionInput(input: BrowserSessionInput): void {
  if (!input.sessionId.startsWith("dt_")) throw new Error("DOMTune browser sessions require a dt_ session ID.");
  if (!isAbsolute(input.workspace)) throw new Error("DOMTune controlled-browser mode requires an absolute workspace path.");
  const target = new URL(input.targetUrl);
  if (!isLocalDevelopmentUrl(target) && process.env.DOMTUNE_ALLOW_REMOTE_TARGETS !== "1") {
    throw new Error("DOMTune controlled-browser mode only opens localhost development URLs by default. Set DOMTUNE_ALLOW_REMOTE_TARGETS=1 to opt into a remote target.");
  }
}

export function isLocalDevelopmentUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const hostname = url.hostname.toLowerCase();
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1";
}

export async function assertTargetReachable(targetUrl: string, timeoutMs = 2_500): Promise<void> {
  const url = new URL(targetUrl);
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  await new Promise<void>((resolve, reject) => {
    const host = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
    const socket = createConnection({ host, port });
    const finish = (error?: Error) => {
      socket.removeAllListeners();
      socket.destroy();
      error ? reject(error) : resolve();
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish());
    socket.once("timeout", () => finish(new Error(`DOMTune could not reach ${url.origin} within ${timeoutMs}ms. Start the development server and try again.`)));
    socket.once("error", (error) => finish(new Error(`DOMTune could not reach ${url.origin}: ${error.message}. Start the development server and try again.`)));
  });
}

export async function cleanupStaleBrowserSessions(sessionsRoot: string, staleProfileAgeMs: number, now = Date.now()): Promise<void> {
  await mkdir(sessionsRoot, { recursive: true });
  const entries = await readdir(sessionsRoot, { withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const sessionRoot = join(sessionsRoot, entry.name);
    const sessionFile = join(sessionRoot, "session.json");
    let persisted: PersistedBrowserSession | undefined;
    try {
      persisted = JSON.parse(await readFile(sessionFile, "utf8")) as PersistedBrowserSession;
    } catch {
      // An incomplete launch may not have written metadata.
    }

    if (persisted?.pid && isProcessRunning(persisted.pid)) {
      if (await debugEndpointOwnsSession(persisted)) {
        await stopProcess(persisted.pid);
        await removeSessionRoot(sessionRoot);
      }
      return;
    }

    if (persisted) {
      await removeSessionRoot(sessionRoot);
      return;
    }

    try {
      const details = await stat(sessionRoot);
      if (now - details.mtimeMs >= staleProfileAgeMs) await removeSessionRoot(sessionRoot);
    } catch {
      // The directory may have been removed concurrently.
    }
  }));
}

export function buildChromiumArgs(input: { debugPort: number; profileRoot: string; pageUrl: string }): string[] {
  return [
    `--remote-debugging-port=${input.debugPort}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${input.profileRoot}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--new-window",
    input.pageUrl
  ];
}

export async function findChromiumExecutable(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  const configured = env.DOMTUNE_BROWSER_EXECUTABLE;
  if (configured) {
    if (!isAbsolute(configured)) throw new Error("DOMTUNE_BROWSER_EXECUTABLE must be an absolute path.");
    await assertExecutable(configured);
    return configured;
  }

  const candidates = chromiumCandidates(platform, env);
  for (const candidate of candidates) {
    try {
      await assertExecutable(candidate);
      return candidate;
    } catch {
      // Continue to the next known installation path.
    }
  }
  return undefined;
}

export function chromiumCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    ];
  }
  if (platform === "win32") {
    const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter((value): value is string => Boolean(value));
    return roots.flatMap((root) => [
      join(root, "Google", "Chrome", "Application", "chrome.exe"),
      join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
    ]);
  }
  const pathRoots = (env.PATH ?? "").split(delimiter).filter(Boolean);
  return pathRoots.flatMap((root) => ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"].map((name) => join(root, name)));
}

function withSessionId(targetUrl: string, sessionId: string): string {
  const url = new URL(targetUrl);
  url.searchParams.set("domTuneSession", sessionId);
  return url.toString();
}

async function assertExecutable(path: string): Promise<void> {
  await access(path, constants.X_OK);
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function debugEndpointOwnsSession(session: PersistedBrowserSession): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${session.debugPort}/json/list`, { signal: AbortSignal.timeout(1_000) });
    if (!response.ok) return false;
    const targets = await response.json() as CdpTarget[];
    return targets.some((target) => {
      try {
        return new URL(target.url).searchParams.get("domTuneSession") === session.sessionId;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function stopProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  for (let attempt = 0; attempt < 15 && isProcessRunning(pid); attempt += 1) await delay(100);
  if (!isProcessRunning(pid)) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process exited between the checks.
  }
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await Promise.race([exited, delay(1_500)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function removeSessionRoot(sessionRoot: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await rm(sessionRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await delay(100 * (attempt + 1));
    }
  }
}

async function reserveLoopbackPort(): Promise<number> {
  const server = createServer();
  return await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a browser debugging port."));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForPageTarget(port: number, pageUrl: string, timeoutMs: number, child: ChildProcess, getSpawnError: () => Error | undefined): Promise<CdpTarget> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) throw new Error(`DOMTune could not start the controlled browser: ${spawnError.message}`);
    if (child.exitCode !== null) throw new Error(`The controlled browser exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json() as CdpTarget[];
        const expected = new URL(pageUrl);
        const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl && samePage(item.url, expected));
        if (target) return target;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`DOMTune timed out while connecting to the controlled browser.${detail}`);
}

function samePage(candidate: string, expected: URL): boolean {
  try {
    const url = new URL(candidate);
    return url.origin === expected.origin && url.pathname === expected.pathname;
  } catch {
    return false;
  }
}

function browserName(executable: string): string {
  const lower = executable.toLowerCase();
  if (lower.includes("edge")) return "Microsoft Edge";
  if (lower.includes("brave")) return "Brave";
  if (lower.includes("chromium")) return "Chromium";
  return "Google Chrome";
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
