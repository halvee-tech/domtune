export interface SessionBridgeState {
  connected: boolean;
  lastSeenAt?: string;
}

export class SessionBridgeStatus {
  private readonly heartbeats = new Map<string, number>();

  constructor(private readonly timeoutMs = 6_000, private readonly now: () => number = Date.now) {}

  touch(sessionId: string): SessionBridgeState {
    const timestamp = this.now();
    this.heartbeats.set(sessionId, timestamp);
    return { connected: true, lastSeenAt: new Date(timestamp).toISOString() };
  }

  get(sessionId: string): SessionBridgeState {
    const timestamp = this.heartbeats.get(sessionId);
    if (timestamp === undefined) return { connected: false };
    const connected = this.now() - timestamp <= this.timeoutMs;
    if (!connected) this.heartbeats.delete(sessionId);
    return { connected, lastSeenAt: new Date(timestamp).toISOString() };
  }
}
