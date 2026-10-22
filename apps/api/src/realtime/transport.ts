/**
 * The transport port of the realtime server (ADR-007 point 1): the only
 * surface the gateway sees of a WebSocket, so nothing outside `ws-transport.ts`
 * imports the `ws` library and the gateway can be tested with a fake socket.
 */
export interface RealtimeSocket {
  /** Bytes queued to send and not yet written to the network. */
  readonly bufferedAmount: number;
  send: (data: string) => void;
  ping: () => void;
  close: (code: number, reason: string) => void;
  /** Called with the text of every inbound message. */
  onMessage: (listener: (data: string) => void) => void;
  onPong: (listener: () => void) => void;
  /** Called once with the close code, whoever closed the socket. */
  onClose: (listener: (code: number) => void) => void;
}

export interface RealtimeTransport {
  /** Registers the handler of every accepted connection; one handler per transport. */
  onConnection: (listener: (socket: RealtimeSocket) => void) => void;
  /** Closes every open socket with the code and waits until they are gone. */
  close: (code: number, reason: string) => Promise<void>;
}
