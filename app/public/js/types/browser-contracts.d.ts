// Supported browser wire boundary. The view is deliberately opaque: schema V1/V2/V3
// use separate runtime validators; an envelope must not claim its nested view is trusted.
export type PublicView = Record<string, unknown>;
export type ActionRequest = { type: string; actionId?: string; [field: string]: unknown };
export type ServerStateEnvelope = { type: 'state'; view: PublicView; cursor?: number; [field: string]: unknown };
export type ServerStateDeltaEnvelope = { type: 'state-delta'; baseCursor: number; cursor: number; patch: PublicView; removed: string[]; changedKeys: string[] };
export type ServerErrorEnvelope = { type: 'error'; error: string; actionId?: string };
export type ServerActionAck = {
  type: 'action-ack'; actionId: string; actionType: string;
  duplicate?: boolean; committedRevision?: number; authoritativeRevision?: number;
  commitStatus?: 'committed' | 'session';
};
export type ServerEnvelope = ServerStateEnvelope | ServerStateDeltaEnvelope | ServerErrorEnvelope | ServerActionAck;
export type SocketLike = Pick<WebSocket, 'readyState' | 'send' | 'close' | 'onopen' | 'onmessage' | 'onclose' | 'onerror'>;
export type SocketConstructor = { new(url: string): SocketLike; OPEN?: number };
export interface ConnectionOptions {
  url: string;
  playerId: string;
  WebSocketImpl: SocketConstructor;
  onState?: (view: PublicView, envelope: ServerStateEnvelope | ServerStateDeltaEnvelope) => void;
  onError?: (message: string, envelope: ServerErrorEnvelope) => void;
  onStatus?: (connected: boolean) => void;
  onActionAck?: (ack: ServerActionAck) => void;
  onFatal?: (code: number) => void;
  reconnect?: boolean;
  pingMs?: number;
  pongTimeoutMs?: number;
  joinTimeoutMs?: number;
  random?: () => number;
}
