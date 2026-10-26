import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { delimiter, isAbsolute, join } from "node:path";
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

  private constructor(private readonly socket: WebSocket) {
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString()) as { id?: number; result?: unknown; error?: { message?: string } };
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
      const source = buildOverlayClient({
        bridgeUrl: input.bridgeUrl,
        workspace: input.workspace,
        sessionId: input.sessionId,
        targetOrigin: new URL(input.targetUrl).origin
      });
      await client.send("Page.enable");
      await client.send("Runtime.enable");
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
      const active = { state, sessionRoot, child, client };
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
