import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WSMessage, WSResponse, MSWStatus } from './protocol.js';
import { type PersistenceConfig } from './server.js';

export class ConnectionManager {
  private clients = new Set<WebSocket>();
  private pendingRequests = new Map<string, (response: WSResponse) => void>();
  private singleClientMode: boolean;
  private lastClient: WebSocket | null = null;
  private persistenceConfig: PersistenceConfig;

  constructor(
    singleClientMode: boolean = false,
    persistenceConfig: PersistenceConfig = {
      persistHandlers: false,
      persistLimit: null,
    },
  ) {
    this.singleClientMode = singleClientMode;
    this.persistenceConfig = persistenceConfig;
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    this.lastClient = ws; // Track the most recently connected client

    ws.on('message', (data) => {
      try {
        const response: WSResponse = JSON.parse(data.toString());
        const resolver = this.pendingRequests.get(response.id);
        if (resolver) {
          resolver(response);
          this.pendingRequests.delete(response.id);
        }
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      // If the last client disconnected, clear the reference
      if (this.lastClient === ws) {
        this.lastClient = null;
      }
    });
  }

  async sendMessage(message: WSMessage): Promise<WSResponse> {
    return new Promise((resolve, reject) => {
      if (this.clients.size === 0) {
        reject(new Error('No browser clients connected'));
        return;
      }

      const messageId = uuidv4();
      const messageWithId = {
        ...message,
        id: messageId,
        persist: this.persistenceConfig.persistHandlers,
        persistLimit: this.persistenceConfig.persistLimit,
      };

      // Store the resolver for this request
      this.pendingRequests.set(messageId, resolve);

      if (this.singleClientMode) {
        // Single-client mode: send only to the last connected client
        if (this.lastClient && this.lastClient.readyState === WebSocket.OPEN) {
          this.lastClient.send(JSON.stringify(messageWithId));
        } else {
          // Fallback to first available client if lastClient is unavailable
          const client = Array.from(this.clients)[0];
          if (client && client.readyState === WebSocket.OPEN) {
            this.lastClient = client;
            client.send(JSON.stringify(messageWithId));
          } else {
            reject(new Error('No clients available'));
            return;
          }
        }
      } else {
        // Broadcast mode: send to all connected clients
        let sentToAny = false;
        this.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(messageWithId));
            sentToAny = true;
          }
        });

        if (!sentToAny) {
          reject(new Error('No clients available'));
          return;
        }
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

  async getStatus(): Promise<MSWStatus> {
    const connected = this.clients.size > 0;
    if (!connected) {
      return {
        connected: false,
        workerStatus: 'unknown',
        activeHandlers: [],
      };
    }

    try {
      const response = await this.sendMessage({
        id: '',
        type: 'GET_STATUS',
      });

      return {
        connected: true,
        workerStatus: response.workerStatus ?? 'unknown',
        activeHandlers: response.activeHandlers ?? [],
      };
    } catch {
      return {
        connected: true,
        workerStatus: 'unknown',
        activeHandlers: [],
      };
    }
  }

  hasConnectedClients(): boolean {
    return this.clients.size > 0;
  }
}
