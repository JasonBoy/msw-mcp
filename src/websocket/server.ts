import WebSocket, { WebSocketServer } from 'ws';
import { ConnectionManager } from './connection-manager.js';

export class WSServer {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;

  constructor(port: number = 8080) {
    this.connectionManager = new ConnectionManager();
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      console.error('Browser client connected to WebSocket');
      this.connectionManager.addClient(ws);
    });

    console.error(`WebSocket server listening on port ${port}`);
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  close(): void {
    this.wss.close();
  }
}
