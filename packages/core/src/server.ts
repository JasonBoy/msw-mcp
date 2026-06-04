import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { ConnectionManager } from './connection-manager.js';
import type { WSMessage, WSResponse } from './protocol.js';
import { SessionManager } from './session-manager.js';

export interface PersistenceConfig {
  persistHandlers: boolean;
  persistLimit: number | null;
}

const MAX_PORT_ATTEMPTS = 20;

export class WSServer {
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private connectionManager: ConnectionManager;
  private port: number;
  private readonly initialPort: number;
  private singleClient: boolean;
  private persistenceConfig: PersistenceConfig;
  private isTakingOver: boolean = false;
  private sessionName: string;
  private sessionManager: SessionManager;
  private strictPort: boolean;

  constructor(
    port: number = 8080,
    singleClient: boolean = false,
    persistenceConfig: PersistenceConfig = {
      persistHandlers: false,
      persistLimit: null,
    },
    sessionName: string = SessionManager.getDefaultSessionName(),
    strictPort: boolean = false,
  ) {
    this.port = port;
    this.initialPort = port;
    this.strictPort = strictPort;
    this.singleClient = singleClient;
    this.persistenceConfig = persistenceConfig;
    this.sessionName = sessionName;
    this.sessionManager = new SessionManager();
    this.connectionManager = new ConnectionManager(
      singleClient,
      persistenceConfig,
    );

    // Try to start server initially
    this.tryStartServer();

    // Graceful shutdown
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
    process.on('exit', () => this.close());
  }

  private cleanupPendingServer(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  private handlePortInUse(): boolean {
    if (this.strictPort) {
      console.error(
        `❌ Port ${this.port} is already in use. Choose a different port or stop the process using it.`,
      );
      process.exit(1);
    }
    return this.tryNextPort();
  }

  private tryNextPort(): boolean {
    const portsTried = this.port - this.initialPort + 1;
    if (portsTried >= MAX_PORT_ATTEMPTS) {
      console.error(
        `❌ Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts (starting from ${this.initialPort}).`,
      );
      return false;
    }

    console.error(
      `⚠️  Port ${this.port} is already in use, trying port ${this.port + 1}...`,
    );
    this.port++;
    return this.tryStartServer();
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

        // Send welcome message to confirm connection is stable
        ws.send(
          JSON.stringify({
            id: 'welcome',
            type: 'WELCOME',
          }),
        );
      });

      // Handle async listen errors - only need to handle on HTTP server
      // (WebSocket server shares the same underlying server)
      let errorHandled = false;
      this.httpServer.on('error', (error: any) => {
        if (errorHandled) return;
        errorHandled = true;

        if (error.code === 'EADDRINUSE') {
          this.cleanupPendingServer();
          this.handlePortInUse();
        } else {
          console.error(`❌ Server error:`, error);
          this.cleanupPendingServer();
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

        const addr = this.httpServer!.address();
        const actualPort =
          typeof addr === 'string' ? this.port : addr?.port || this.port;
        this.port = actualPort;

        console.error(
          `✅ Server started successfully for session "${this.sessionName}" on port ${this.port} (HTTP + WebSocket, ${mode}, ${persistMsg})`,
        );

        // Register session
        this.sessionManager.registerSession({
          name: this.sessionName,
          port: this.port,
          pid: process.pid,
          cwd: process.cwd(),
          startTime: Date.now(),
        });
      });

      // Listen on single port for both HTTP and WS
      this.httpServer.listen(this.port);

      return true;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        this.cleanupPendingServer();
        return this.handlePortInUse();
      }
      throw error;
    }
  }

  private handleHTTPRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    // Handle POST /api/tools/* for proxy requests from secondary MCPs or CLI
    if (
      req.method === 'POST' &&
      (req.url?.startsWith('/api/tools/') || req.url === '/api/status')
    ) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          if (req.url === '/api/status') {
            const status = await this.connectionManager.getStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
            return;
          }

          const message: WSMessage = JSON.parse(body);
          console.error(`🔀 Received tool call: ${message.type}`);
          const response = await this.connectionManager.sendMessage(message);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error: any) {
          console.error(`  ❌ Tool call failed:`, error.message);
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

  private async proxyToPrimary(message: WSMessage): Promise<WSResponse> {
    console.error(`🔀 Proxying tool call to primary instance: ${message.type}`);

    // Find the port from the session manager
    const session = this.sessionManager.getSession(this.sessionName);
    const targetPort = session ? session.port : this.port;

    const response = await fetch(
      `http://localhost:${targetPort}/api/tools/${message.type.toLowerCase()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      },
    );

    if (!response.ok) {
      const error: any = new Error(
        `HTTP ${response.status}: ${response.statusText}`,
      );
      if (response.status >= 500 || !response.ok) {
        error.code = 'ECONNREFUSED';
      }
      throw error;
    }

    return (await response.json()) as WSResponse;
  }

  async sendMessage(message: WSMessage): Promise<WSResponse> {
    // If we have our own server, send directly
    if (this.httpServer && this.wss) {
      return await this.connectionManager.sendMessage(message);
    }

    // Otherwise, proxy to primary
    try {
      return await this.proxyToPrimary(message);
    } catch (error: any) {
      // If proxy failed with connection error, attempt takeover
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET' ||
        error.cause?.code === 'ECONNREFUSED'
      ) {
        console.error(
          '⚠️  Primary instance not responding. Attempting takeover...',
        );

        await this.attemptTakeover();

        // After takeover, send directly via our new server
        return await this.connectionManager.sendMessage(message);
      }

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
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.sessionManager.removeSession(this.sessionName);
  }
}
