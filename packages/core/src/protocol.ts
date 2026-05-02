export interface WSMessage {
  id: string;
  type: WSMessageType;
  handlers?: string[] | undefined;
  patterns?: string[] | undefined;
  methods?: string[] | undefined;
  once?: boolean | undefined;
  persist?: boolean | undefined;
  persistLimit?: number | null | undefined;
  data?: any;
}

export type WSMessageType =
  | 'ADD_HANDLERS'
  | 'RESET_HANDLERS'
  | 'REMOVE_HANDLERS'
  | 'UPDATE_HANDLERS'
  | 'GET_STATUS'
  | 'SUCCESS'
  | 'ERROR'
  | 'STATUS_RESPONSE'
  | 'WELCOME';

export interface WSResponse extends WSMessage {
  type: 'SUCCESS' | 'ERROR' | 'STATUS_RESPONSE';
  activeHandlers?: string[];
  workerStatus?: 'running' | 'stopped' | 'unknown';
  error?: string;
}

export interface MSWStatus {
  connected: boolean;
  workerStatus: 'running' | 'stopped' | 'unknown';
  activeHandlers: string[];
}
