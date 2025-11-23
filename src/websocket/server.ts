import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { ConnectionManager } from './connection-manager.js';
import type { WSMessage, WSResponse } from './protocol.js';

export interface PersistenceConfig {
  persistHandlers: boolean;
  persistLimit: number | null;
}

export class WSServer {
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private connectionManager: ConnectionManager;
  private port: number;
  private singleClient: boolean;
  private persistenceConfig: PersistenceConfig;
  private isTakingOver: boolean = false;

  constructor(
    port: number = 8080,
    singleClient: boolean = false,
    persistenceConfig: PersistenceConfig = {
      persistHandlers: false,
      persistLimit: null,
    },
  ) {
    this.port = port;
    this.singleClient = singleClient;
    this.persistenceConfig = persistenceConfig;
    this.connectionManager = new ConnectionManager(
      singleClient,
      persistenceConfig,
    );

    // Try to start server initially
    this.tryStartServer();
  }

  private tryStartServer(): boolean {
    if (this.httpServer) {
      return true; // Already have server
    }

    try {
      // Create HTTP server first
      this.httpServer = http.createServer((req, res) => {
        this.handleHTTPRequest(req, res);
      });

      // Attach WebSocket server to the same HTTP server
      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on('connection', (ws) => {
        console.error('✅ Browser client connected to WebSocket');
        this.connectionManager.addClient(ws);
      });

      // Handle async listen errors - only need to handle on HTTP server
      // (WebSocket server shares the same underlying server)
      let errorHandled = false;
      this.httpServer.on('error', (error: any) => {
        if (errorHandled) return;
        errorHandled = true;

        if (error.code === 'EADDRINUSE') {
          console.error(
            `⚠️  Port ${this.port} is already in use by another MCP instance. Running in proxy mode.`,
          );
          console.error(
            `ℹ️  Tool calls will be forwarded to the primary MCP server on port ${this.port}.`,
          );
          // Clean up
          this.httpServer = null;
          this.wss = null;
        } else {
          console.error(`❌ Server error:`, error);
        }
      });

      // Suppress WebSocket server errors (they're duplicates of HTTP server errors)
      this.wss.on('error', () => {});

      // Log success only after server is actually listening
      this.httpServer.on('listening', () => {
        const mode = this.singleClient
          ? 'single-client mode'
          : 'broadcast mode';
        const persistMsg = this.persistenceConfig.persistHandlers
          ? `persistence enabled (limit: ${this.persistenceConfig.persistLimit || 'unlimited'})`
          : 'persistence disabled';
        console.error(
          `✅ Server started successfully on port ${this.port} (HTTP + WebSocket, ${mode}, ${persistMsg})`,
        );
      });

      // Listen on single port for both HTTP and WS
      this.httpServer.listen(this.port);

      return true;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.error(
          `⚠️  Port ${this.port} is already in use by another MCP instance. Running in proxy mode.`,
        );
        console.error(
          `ℹ️  Tool calls will be forwarded to the primary MCP server on port ${this.port}.`,
        );
        return false;
      }
      throw error;
    }
  }

  private handleHTTPRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    // Handle POST /api/tools/* for proxy requests from secondary MCPs
    if (req.method === 'POST' && req.url?.startsWith('/api/tools/')) {
      console.error(
        `🔀 Received proxied tool call from secondary MCP: ${req.url}`,
      );
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const message: WSMessage = JSON.parse(body);
          console.error(`  ↳ Tool: ${message.type}`);
          const response = await this.connectionManager.sendMessage(message);
          console.error(`  ✅ Proxied tool call completed successfully`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error: any) {
          console.error(`  ❌ Proxied tool call failed:`, error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  private async attemptTakeover(): Promise<void> {
    if (this.isTakingOver) {
      throw new Error('Takeover already in progress');
    }

    this.isTakingOver = true;
    console.error(`🔄 Attempting to take over server on port ${this.port}...`);

    const success = this.tryStartServer();

    if (!success) {
      this.isTakingOver = false;
      throw new Error(
        'Failed to start server - port still in use by another process',
      );
    }

    console.error('✅ Successfully took over server');
    console.error('⏳ Waiting 6 seconds for browser to reconnect...');
    await new Promise((resolve) => setTimeout(resolve, 6000));

    this.isTakingOver = false;
  }

  private async proxyToMCP(message: WSMessage): Promise<WSResponse> {
    console.error(`🔀 Proxying tool call to primary MCP: ${message.type}`);
    const response = await fetch(
      `http://localhost:${this.port}/api/tools/proxy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      },
    );
    console.error(`  ✅ Primary MCP responded with status ${response.status}`);

    if (!response.ok) {
      const error: any = new Error(
        `HTTP ${response.status}: ${response.statusText}`,
      );
      if (response.status >= 500 || !response.ok) {
        error.code = 'ECONNREFUSED';
      }
      throw error;
    }

    return await response.json();
  }

  async sendMessage(message: WSMessage): Promise<WSResponse> {
    // If we have our own server, send directly
    if (this.httpServer && this.wss) {
      return await this.connectionManager.sendMessage(message);
    }

    // Otherwise, proxy to primary MCP
    console.error(`ℹ️  Running in proxy mode, forwarding to primary MCP...`);
    try {
      return await this.proxyToMCP(message);
    } catch (error: any) {
      console.error(`❌ Proxy failed:`, error.message);
      // If proxy failed with connection error, attempt takeover
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET' ||
        error.cause?.code === 'ECONNREFUSED'
      ) {
        console.error('⚠️  Primary MCP not responding. Attempting takeover...');

        await this.attemptTakeover();

        // After takeover, send directly via our new server
        return await this.connectionManager.sendMessage(message);
      }

      // Other errors, re-throw
      throw error;
    }
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  isServerActive(): boolean {
    return this.httpServer !== null && this.wss !== null;
  }

  close(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
  }
}
