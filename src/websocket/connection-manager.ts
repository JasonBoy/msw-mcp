import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WSMessage, WSResponse, MSWStatus } from './protocol.js';

export class ConnectionManager {
  private clients = new Set<WebSocket>();
  private pendingRequests = new Map<string, (response: WSResponse) => void>();

  addClient(ws: WebSocket): void {
    this.clients.add(ws);

    ws.on('message', (data) => {
      try {
        const response: WSResponse = JSON.parse(data.toString());
        const resolver = this.pendingRequests.get(response.id);
        if (resolver) {
          resolver(response);
          this.pendingRequests.delete(response.id);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  async sendMessage(message: WSMessage): Promise<WSResponse> {
    return new Promise((resolve, reject) => {
      if (this.clients.size === 0) {
        reject(new Error('No browser clients connected'));
        return;
      }

      const messageId = uuidv4();
      const messageWithId = { ...message, id: messageId };

      // Store the resolver for this request
      this.pendingRequests.set(messageId, resolve);

      // Send to first available client (in real implementation, might want to target specific client)
      const client = Array.from(this.clients)[0];
      if (client) {
        client.send(JSON.stringify(messageWithId));
      } else {
        reject(new Error('No clients available'));
        return;
      }

      // Set timeout to avoid hanging forever
      setTimeout(() => {
        if (this.pendingRequests.has(messageId)) {
          this.pendingRequests.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  getStatus(): MSWStatus {
    return {
      connected: this.clients.size > 0,
      workerStatus: 'unknown',
      activeHandlers: [],
    };
  }

  hasConnectedClients(): boolean {
    return this.clients.size > 0;
  }
}
