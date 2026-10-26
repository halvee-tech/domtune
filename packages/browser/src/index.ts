import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
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
  browser: string;
  pid?: number;
  debugPort: number;
  pageUrl: string;
}

export interface BrowserSessionLauncher {
  open(input: BrowserSessionInput): Promise<BrowserSession>;
  close(sessionId: string): Promise<boolean>;
}

export interface ChromiumLauncherOptions {
  dataRoot: string;
  executable?: string;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  launchTimeoutMs?: number;
  spawnProcess?: typeof spawn;
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
  private readonly sessions = new Map<string, { child: ChildProcess; client: CdpClient }>();

  constructor(private readonly options: ChromiumLauncherOptions) {
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.timeoutMs = options.launchTimeoutMs ?? 12_000;
    this.spawnProcess = options.spawnProcess ?? spawn;
  }

  async open(input: BrowserSessionInput): Promise<BrowserSession> {
    validateBrowserSessionInput(input);
    await this.close(input.sessionId);
    const executable = this.options.executable ?? await findChromiumExecutable(this.platform, this.env);
    if (!executable) {
      throw new Error("DOMTune could not find Chrome, Chromium, Microsoft Edge, or Brave. Install a Chromium browser or set DOMTUNE_BROWSER_EXECUTABLE.");
    }

    const sessionRoot = join(this.options.dataRoot, "browser-sessions", input.sessionId);
    const profileRoot = join(sessionRoot, "profile");
    await mkdir(profileRoot, { recursive: true });
    const debugPort = await reserveLoopbackPort();
    const pageUrl = withSessionId(input.targetUrl, input.sessionId);
    const args = buildChromiumArgs({ debugPort, profileRoot, pageUrl });
    const child = this.spawnProcess(executable, args, {
      detached: false,
      stdio: "ignore",
      env: this.env
    });
    let spawnError: Error | undefined;
    child.once("error", (error) => { spawnError = error; });
    child.unref();

    try {
      const target = await waitForPageTarget(debugPort, pageUrl, this.timeoutMs, child, () => spawnError);
      const client = await CdpClient.connect(target.webSocketDebuggerUrl!);
      const source = buildOverlayClient({
        bridgeUrl: input.bridgeUrl,
        workspace: input.workspace,
        sessionId: input.sessionId,
        targetOrigin: new URL(input.targetUrl).origin
      });
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Page.addScriptToEvaluateOnNewDocument", { source });
      await client.send("Runtime.evaluate", { expression: source, awaitPromise: true });
      this.sessions.set(input.sessionId, { child, client });
      return { browser: browserName(executable), pid: child.pid, debugPort, pageUrl };
    } catch (error) {
      child.kill();
      throw error;
    }
  }

  async close(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    session.client.close();
    if (session.child.exitCode === null) session.child.kill();
    return true;
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
