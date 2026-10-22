import type { RealtimeSocket, RealtimeTransport } from "./transport.js";

/** A socket that records what the gateway does to it, for tests. */
export class FakeSocket implements RealtimeSocket {
  bufferedAmount = 0;
  readonly sent: string[] = [];
  pings = 0;
  closedWith: { code: number; reason: string } | undefined;
  private messageListeners: ((data: string) => void)[] = [];
  private pongListeners: (() => void)[] = [];
  private closeListeners: ((code: number) => void)[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  ping(): void {
    this.pings += 1;
  }

  close(code: number, reason: string): void {
    if (this.closedWith) {
      return;
    }
    this.closedWith = { code, reason };
    for (const listener of this.closeListeners) {
      listener(code);
    }
  }

  onMessage(listener: (data: string) => void): void {
    this.messageListeners.push(listener);
  }

  onPong(listener: () => void): void {
    this.pongListeners.push(listener);
  }

  onClose(listener: (code: number) => void): void {
    this.closeListeners.push(listener);
  }

  /** The client sends a message: text as is, anything else as JSON. */
  receive(message: unknown): void {
    const data = typeof message === "string" ? message : JSON.stringify(message);
    for (const listener of this.messageListeners) {
      listener(data);
    }
  }

  pong(): void {
    for (const listener of this.pongListeners) {
      listener();
    }
  }

  /** What the server sent, parsed. */
  replies(): unknown[] {
    return this.sent.map((data) => JSON.parse(data) as unknown);
  }
}

/** A transport that accepts the connections a test makes by hand. */
export class FakeTransport implements RealtimeTransport {
  closedWith: { code: number; reason: string } | undefined;
  private listener: ((socket: RealtimeSocket) => void) | undefined;

  onConnection(listener: (socket: RealtimeSocket) => void): void {
    this.listener = listener;
  }

  close(code: number, reason: string): Promise<void> {
    this.closedWith = { code, reason };
    return Promise.resolve();
  }

  connect(): FakeSocket {
    const socket = new FakeSocket();
    this.listener?.(socket);
    return socket;
  }
}
