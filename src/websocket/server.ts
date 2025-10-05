import WebSocket, { WebSocketServer } from 'ws';
import { ConnectionManager } from './connection-manager.js';

export interface PersistenceConfig {
  persistHandlers: boolean;
  persistLimit: number | null;
}

export class WSServer {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;

  constructor(
    port: number = 8080,
    singleClient: boolean = false,
    persistenceConfig: PersistenceConfig = {
      persistHandlers: false,
      persistLimit: null,
    },
  ) {
    this.connectionManager = new ConnectionManager(
      singleClient,
      persistenceConfig,
    );
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      console.error('Browser client connected to WebSocket');
      this.connectionManager.addClient(ws);
    });

    const mode = singleClient ? 'single-client mode' : 'broadcast mode';
    const persistMsg = persistenceConfig.persistHandlers
      ? `persistence enabled (limit: ${persistenceConfig.persistLimit || 'unlimited'})`
      : 'persistence disabled';
    console.error(
      `WebSocket server listening on port ${port} (${mode}, ${persistMsg})`,
    );
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  close(): void {
    this.wss.close();
  }
}
