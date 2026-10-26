import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  CHANGE_SET_SCHEMA_VERSION,
  changeSetSchema,
  type ChangeSet,
  type ChangeStatus,
  type NewChangeSet
} from "@domtune/core";

export class ChangeSetStore {
  constructor(private readonly filePath: string) {}

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
    await writeFile(this.filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  }

  async create(input: NewChangeSet): Promise<ChangeSet> {
    const items = await this.readAll();
    const item: ChangeSet = {
      ...input,
      schemaVersion: CHANGE_SET_SCHEMA_VERSION,
      id: `dt_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    items.push(item);
    await this.writeAll(items);
    return item;
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
    const items = await this.readAll();
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return undefined;
    item.conversationNotifiedAt = new Date().toISOString();
    await this.writeAll(items);
    return item;
  }

  async report(
    id: string,
    status: Extract<ChangeStatus, "applied" | "failed">,
    result: NonNullable<ChangeSet["result"]>
  ): Promise<ChangeSet | undefined> {
    const items = await this.readAll();
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return undefined;
    item.status = status;
    item.result = result;
    await this.writeAll(items);
    return item;
  }
}
