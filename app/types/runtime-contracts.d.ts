export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SaveState {
  schemaVersion?: number;
  revision?: number;
  [key: string]: JsonValue | undefined;
}

export interface CommandAction {
  type: string;
  actionId?: string;
  [key: string]: unknown;
}

export interface CommandFailure {
  ok: false;
  code: string;
  [key: string]: unknown;
}

export interface CommandSuccess<TState> {
  ok: true;
  state: TState;
  duplicate?: boolean;
  receipt?: unknown;
  [key: string]: unknown;
}

export type CommandOutcome<TState> = CommandFailure | CommandSuccess<TState>;

export interface StoragePort<TState extends SaveState = SaveState> {
  load(accountId: string): Promise<TState | null>;
  loadForAction(accountId: string, actionId: string): Promise<TState | null>;
  save(accountId: string, state: TState): Promise<void>;
  savePair(entries: Array<{ userId: string; state: TState }>, operationId: string): Promise<{ duplicate: boolean }>;
}

export interface PublicStateDto {
  type: 'state';
  status: string;
  you: string;
  connected: number;
  view: JsonValue;
  result: JsonValue;
  meta: JsonValue;
}

// Closed contracts for high-risk mutations. Legacy/unreviewed actions intentionally
// continue to use CommandAction until their payloads have been audited.
export type ReviewedMutation =
 | {type:'shopV3.buy'; actionId:string; itemId:string; payment:'coins'|'ticket'}
 | {type:'socialV1.friend.request'; actionId:string; friendCode:string}
 | {type:'socialV1.friend.accept'|'socialV1.friend.reject'|'socialV1.friend.cancel'|'socialV1.friend.remove'; actionId:string; accountId:string}
 | {type:'socialV1.chat.send'; actionId:string; accountId:string; text:string}
 | {type:'bagV1.rankProtection'; actionId:string; enabled:boolean};
export type AccountPair = [
  {userId:string; state:SaveState},
  {userId:string; state:SaveState}
];
