import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, open, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  CHANGE_SET_SCHEMA_VERSION,
  changeSetSchema,
  newChangeSetSchema,
  type ChangeSet,
  type ChangeStatus,
  type NewChangeSet
} from "@domtune/core";

export class ChangeSetStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeQueue;
    let release!: () => void;
    this.writeQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    let releaseFileLock: (() => Promise<void>) | undefined;
    try {
      releaseFileLock = await this.acquireFileLock();
      return await operation();
    } finally {
      try {
        await releaseFileLock?.();
      } finally {
        release();
      }
    }
  }

  private async acquireFileLock(): Promise<() => Promise<void>> {
    const lockPath = `${this.filePath}.lock`;
    const deadline = Date.now() + 10_000;
    await mkdir(dirname(this.filePath), { recursive: true });
    while (true) {
      try {
        const handle = await open(lockPath, "wx");
        return async () => {
          await handle.close();
          await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          });
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const details = await stat(lockPath);
          if (Date.now() - details.mtimeMs > 30_000) {
            await unlink(lockPath);
            continue;
          }
        } catch (lockError) {
          if ((lockError as NodeJS.ErrnoException).code !== "ENOENT") throw lockError;
        }
        if (Date.now() >= deadline) throw new Error(`Timed out waiting for the DOMTune store lock at ${lockPath}.`);
        await delay(10 + Math.floor(Math.random() * 20));
      }
    }
  }

  private async readAll(): Promise<ChangeSet[]> {
    try {
      const input: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
      return changeSetSchema.array().parse(input);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAll(items: ChangeSet[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
      await rename(temporaryPath, this.filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async create(input: NewChangeSet): Promise<ChangeSet> {
    return this.withWriteLock(async () => {
      const items = await this.readAll();
      const parsed = newChangeSetSchema.parse(input);
      const item: ChangeSet = {
        ...parsed,
        schemaVersion: CHANGE_SET_SCHEMA_VERSION,
        id: `dt_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      items.push(item);
      await this.writeAll(items);
      return item;
    });
  }

  async list(sessionId?: string): Promise<ChangeSet[]> {
    const items = await this.readAll();
    return items
      .filter((item) => !sessionId || item.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<ChangeSet | undefined> {
    return (await this.readAll()).find((item) => item.id === id);
  }

  async markConversationNotified(id: string): Promise<ChangeSet | undefined> {
    return this.withWriteLock(async () => {
      const items = await this.readAll();
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return undefined;
      delete item.conversationClaimedAt;
      item.conversationNotifiedAt = new Date().toISOString();
      await this.writeAll(items);
      return item;
    });
  }

  async claimPendingForConversation(sessionId: string): Promise<ChangeSet | undefined> {
    return this.withWriteLock(async () => {
      const items = await this.readAll();
      let item: ChangeSet | undefined;
      for (let index = 0; index < items.length; index += 1) {
        const candidate = items[index];
        const claimedAt = candidate.conversationClaimedAt ? Date.parse(candidate.conversationClaimedAt) : Number.NaN;
        const claimAvailable = !candidate.conversationClaimedAt || !Number.isFinite(claimedAt) || Date.now() - claimedAt > 60_000;
        if (candidate.sessionId === sessionId && candidate.status === "pending" && claimAvailable && !candidate.conversationNotifiedAt) {
          item = candidate;
          break;
        }
      }
      if (!item) return undefined;
      item.conversationClaimedAt = new Date().toISOString();
      await this.writeAll(items);
      return item;
    });
  }

  async releaseConversationClaim(id: string, claimedAt?: string): Promise<ChangeSet | undefined> {
    return this.withWriteLock(async () => {
      const items = await this.readAll();
      const item = items.find((candidate) => candidate.id === id);
      if (!item?.conversationClaimedAt) return item;
      if (claimedAt && item.conversationClaimedAt !== claimedAt) return item;
      delete item.conversationClaimedAt;
      await this.writeAll(items);
      return item;
    });
  }

  async report(
    id: string,
    status: Extract<ChangeStatus, "applied" | "failed">,
    result: NonNullable<ChangeSet["result"]>
  ): Promise<ChangeSet | undefined> {
    return this.withWriteLock(async () => {
      const items = await this.readAll();
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return undefined;
      item.status = status;
      item.result = result;
      await this.writeAll(items);
      return item;
    });
  }
}
