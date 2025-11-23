import WebSocket, { WebSocketServer } from 'ws';
import { ConnectionManager } from './connection-manager.js';

export interface PersistenceConfig {
  persistHandlers: boolean;
  persistLimit: number | null;
}

export class WSServer {
  private wss: WebSocketServer | null = null;
  private connectionManager: ConnectionManager;
  private isActive: boolean = false;

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

    try {
      this.wss = new WebSocketServer({ port });
      this.isActive = true;

      this.wss.on('connection', (ws) => {
        console.error('Browser client connected to WebSocket');
        this.connectionManager.addClient(ws);
      });

      this.wss.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(
            `WebSocket port ${port} is already in use. This MCP instance will continue without a WebSocket server.`,
          );
          this.isActive = false;
        } else {
          console.error('WebSocket server error:', error);
        }
      });

      const mode = singleClient ? 'single-client mode' : 'broadcast mode';
      const persistMsg = persistenceConfig.persistHandlers
        ? `persistence enabled (limit: ${persistenceConfig.persistLimit || 'unlimited'})`
        : 'persistence disabled';
      console.error(
        `WebSocket server listening on port ${port} (${mode}, ${persistMsg})`,
      );
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.error(
          `WebSocket port ${port} is already in use by another MCP instance. This MCP server will continue without a WebSocket server.`,
        );
        console.error(
          `The existing WebSocket server on port ${port} will handle browser communication.`,
        );
        this.isActive = false;
      } else {
        throw error;
      }
    }
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  isServerActive(): boolean {
    return this.isActive;
  }

  close(): void {
    if (this.wss) {
      this.wss.close();
    }
  }
}
