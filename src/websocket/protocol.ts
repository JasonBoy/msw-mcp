export interface WSMessage {
  id: string;
  type: WSMessageType;
  handlers?: string[] | undefined;
  patterns?: string[] | undefined;
  data?: any;
}

export type WSMessageType =
  | 'ADD_HANDLERS'
  | 'RESET_HANDLERS'
  | 'REMOVE_HANDLERS'
  | 'GET_STATUS'
  | 'SUCCESS'
  | 'ERROR'
  | 'STATUS_RESPONSE';

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
