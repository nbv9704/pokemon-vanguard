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
