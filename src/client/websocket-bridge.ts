// @ts-nocheck - MSW types are peer dependencies
export interface MSWBridgeOptions {
  url?: string; // WebSocket URL (default: ws://localhost:6789)
  reconnectInterval?: number; // Reconnect delay in ms (default: 5000)
  maxReconnectAttempts?: number; // Max reconnect attempts (default: 10)
  enabled?: boolean; // Enable/disable bridge (default: true)
}

interface WSMessage {
  id: string;
  type: string;
  handlers?: string[];
  patterns?: string[];
  methods?: string[];
  once?: boolean;
  persist?: boolean;
  persistLimit?: number | null;
}

interface WSResponse {
  id: string;
  type: string;
  activeHandlers: string[];
  workerStatus: string;
  error?: string;
}

export class MSWWebSocketBridge {
  private worker: any;
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private activeHandlers: Map<string, any> = new Map();
  private persistEnabled: boolean = false;
  private persistLimit: number | null = null;
  private storageKey: string = 'msw_dynamic_handlers';

  constructor(worker: any, options: MSWBridgeOptions = {}) {
    this.worker = worker;
    this.url = options.url || 'ws://localhost:6789';
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;

    // Load persisted handlers before connecting
    this.loadPersistedHandlers();

    // Connect if enabled
    if (options.enabled !== false) {
      this.connect();
    }
  }

  connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isConnecting = true;
    console.log(`[MSW Bridge] Connecting to MCP server at ${this.url}`);

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error(
        '[MSW Bridge] Failed to create WebSocket connection:',
        error,
      );
      this.handleReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[MSW Bridge] Connected to MCP server');
      this.isConnecting = false;
      // Don't reset reconnectAttempts here - only reset after stable connection confirmed
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('[MSW Bridge] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[MSW Bridge] Connection closed:', event.code, event.reason);
      this.isConnecting = false;
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[MSW Bridge] WebSocket error:', error);
      this.isConnecting = false;
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        '[MSW Bridge] Max reconnection attempts reached. Giving up.',
      );
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[MSW Bridge] Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  private extractHandlerInfo(handlerString: string): string {
    const methodMatch = handlerString.match(
      /http\.(get|post|put|delete|patch|options|head|all)/i,
    );
    const urlMatch = handlerString.match(/['"`]([^'"`]+)['"`]/);

    const method = methodMatch ? methodMatch[1].toUpperCase() : 'UNKNOWN';
    const path = urlMatch ? urlMatch[1] : 'unknown';

    return `${method} ${path}`;
  }

  private handleMessage(message: WSMessage): void {
    console.log('[MSW Bridge] Received message:', message);

    // Handle welcome message (confirms stable connection)
    if (message.type === 'WELCOME') {
      if (this.reconnectAttempts > 0) {
        console.log(
          '[MSW Bridge] Connection stable, resetting reconnect counter',
        );
        this.reconnectAttempts = 0;
      }
      return;
    }

    // Update persistence config if provided by server
    if (message.persist !== undefined) {
      this.persistEnabled = message.persist;
      this.persistLimit = message.persistLimit ?? null;
      console.log(
        `[MSW Bridge] Persistence ${
          this.persistEnabled ? 'enabled' : 'disabled'
        } (limit: ${this.persistLimit || 'unlimited'})`,
      );
    }

    const response: WSResponse = {
      id: message.id,
      type: message.type === 'GET_STATUS' ? 'STATUS_RESPONSE' : 'SUCCESS',
      activeHandlers: [],
      workerStatus: 'running',
    };

    try {
      switch (message.type) {
        case 'ADD_HANDLERS':
          this.addHandlers(message.handlers || [], message.once);
          break;

        case 'RESET_HANDLERS':
          this.resetHandlers(message.handlers);
          break;

        case 'REMOVE_HANDLERS':
          this.removeHandlers(message.patterns || [], message.methods);
          break;

        case 'UPDATE_HANDLERS':
          this.updateHandlers(message.patterns || [], message.handlers || []);
          break;

        case 'GET_STATUS':
          // Response already set up above with STATUS_RESPONSE type
          break;

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }

      // Update activeHandlers in response AFTER processing the message
      const handlerSummaries = Array.from(this.activeHandlers.keys()).map(
        (handlerString) => this.extractHandlerInfo(handlerString),
      );
      response.activeHandlers = handlerSummaries;
    } catch (error: any) {
      console.error('[MSW Bridge] Error handling message:', error);
      response.type = 'ERROR';
      response.error = error.message;
    }

    this.sendResponse(response);
  }

  private addHandlers(handlerStrings: string[], once: boolean = false): void {
    console.log('[MSW Bridge] Adding handlers:', handlerStrings, 'once:', once);

    // Import MSW at runtime (peer dependency)
    const msw = (window as any).msw || {};
    const { http, HttpResponse, bypass, passthrough, delay } = msw;

    if (!http || !HttpResponse) {
      throw new Error('MSW not found. Make sure msw is imported in your app.');
    }

    const newHandlers = [];
    for (let handlerString of handlerStrings) {
      try {
        // If once is true, modify the handler string to include { once: true } option
        if (once) {
          handlerString = handlerString.replace(
            /(\))(\s*)$/,
            ', { once: true }$1$2',
          );
        }

        // Create a safe execution context with necessary imports
        const context = {
          http,
          HttpResponse,
          bypass,
          passthrough,
          delay,
          console,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          JSON,
          Math,
          Date,
          Promise,
          fetch: window.fetch,
        };

        // Execute the handler string to get the handler function
        const handler = new Function(
          ...Object.keys(context),
          `return ${handlerString}`,
        )(...Object.values(context));

        if (
          typeof handler === 'function' ||
          (handler && typeof handler.resolver === 'function')
        ) {
          newHandlers.push(handler);
          this.activeHandlers.set(handlerString, handler);
          console.log(
            '[MSW Bridge] Successfully created handler from:',
            handlerString.substring(0, 100) + '...',
          );
        } else {
          throw new Error('Handler string did not return a valid MSW handler');
        }
      } catch (error: any) {
        console.error(
          '[MSW Bridge] Failed to create handler from string:',
          handlerString,
          error,
        );
        throw new Error(`Failed to create handler: ${error.message}`);
      }
    }

    // Add the new handlers to MSW worker
    if (newHandlers.length > 0) {
      this.worker.use(...newHandlers);
      console.log(
        `[MSW Bridge] Added ${newHandlers.length} ${
          once ? 'one-time ' : ''
        }handlers to MSW worker`,
      );
    }

    // Save to localStorage if persistence enabled
    this.saveHandlers();
  }

  private resetHandlers(handlerStrings?: string[]): void {
    console.log('[MSW Bridge] Resetting handlers');

    // Reset worker to original handlers
    this.worker.resetHandlers();

    // Clear our tracking
    this.activeHandlers.clear();

    // Clear persisted handlers
    this.clearPersistedHandlers();

    // Add new handlers if provided
    if (handlerStrings && handlerStrings.length > 0) {
      this.addHandlers(handlerStrings);
    }
  }

  private removeHandlers(patterns: string[], methods?: string[]): void {
    console.log(
      '[MSW Bridge] Removing handlers matching patterns:',
      patterns,
      methods ? `with methods: ${methods.join(', ')}` : '(all methods)',
    );

    const handlersToRemove: Array<{ handlerString: string; handler: any }> = [];

    for (const [handlerString, handler] of this.activeHandlers.entries()) {
      // Extract method from handler string
      const methodMatch = handlerString.match(
        /http\.(get|post|put|delete|patch|options|head|all)/i,
      );
      const handlerMethod = methodMatch ? methodMatch[1].toUpperCase() : null;

      for (const pattern of patterns) {
        if (
          handlerString.includes(pattern) ||
          this.matchesPattern(handlerString, pattern)
        ) {
          // If methods filter is provided, only remove if method matches
          if (methods && methods.length > 0) {
            if (
              handlerMethod &&
              methods.some((m) => m.toUpperCase() === handlerMethod)
            ) {
              handlersToRemove.push({ handlerString, handler });
              break;
            }
          } else {
            // No method filter, remove all matching patterns
            handlersToRemove.push({ handlerString, handler });
            break;
          }
        }
      }
    }

    // Remove from tracking
    for (const { handlerString } of handlersToRemove) {
      this.activeHandlers.delete(handlerString);
    }

    // Reset and re-add remaining handlers
    this.worker.resetHandlers();
    if (this.activeHandlers.size > 0) {
      const remainingHandlers = Array.from(this.activeHandlers.values());
      this.worker.use(...remainingHandlers);
    }

    console.log(`[MSW Bridge] Removed ${handlersToRemove.length} handlers`);

    // Save updated handlers to localStorage
    this.saveHandlers();
  }

  private updateHandlers(
    patterns: string[],
    newHandlerStrings: string[],
  ): void {
    console.log('[MSW Bridge] Updating handlers matching patterns:', patterns);

    // Import MSW at runtime (peer dependency)
    const msw = (window as any).msw || {};
    const { http, HttpResponse, bypass, passthrough, delay } = msw;

    if (!http || !HttpResponse) {
      throw new Error('MSW not found. Make sure msw is imported in your app.');
    }

    // Find handlers to remove
    const handlersToRemove: Array<{ handlerString: string; handler: any }> = [];

    for (const [handlerString, handler] of this.activeHandlers.entries()) {
      for (const pattern of patterns) {
        if (
          handlerString.includes(pattern) ||
          this.matchesPattern(handlerString, pattern)
        ) {
          handlersToRemove.push({ handlerString, handler });
          break;
        }
      }
    }

    // Remove old handlers from tracking
    for (const { handlerString } of handlersToRemove) {
      this.activeHandlers.delete(handlerString);
    }

    console.log(
      `[MSW Bridge] Removed ${handlersToRemove.length} old handlers matching patterns`,
    );

    // Add new handlers
    const newHandlers = [];
    for (const handlerString of newHandlerStrings) {
      try {
        const context = {
          http,
          HttpResponse,
          bypass,
          passthrough,
          delay,
          console,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          JSON,
          Math,
          Date,
          Promise,
          fetch: window.fetch,
        };

        const handler = new Function(
          ...Object.keys(context),
          `return ${handlerString}`,
        )(...Object.values(context));

        if (
          typeof handler === 'function' ||
          (handler && typeof handler.resolver === 'function')
        ) {
          newHandlers.push(handler);
          this.activeHandlers.set(handlerString, handler);
        } else {
          throw new Error('Handler string did not return a valid MSW handler');
        }
      } catch (error: any) {
        console.error(
          '[MSW Bridge] Failed to create handler from string:',
          handlerString,
          error,
        );
        throw new Error(`Failed to create handler: ${error.message}`);
      }
    }

    // Reset and re-add all handlers
    this.worker.resetHandlers();
    if (this.activeHandlers.size > 0) {
      const allHandlers = Array.from(this.activeHandlers.values());
      this.worker.use(...allHandlers);
    }

    console.log(
      `[MSW Bridge] Updated handlers: removed ${handlersToRemove.length}, added ${newHandlers.length}`,
    );

    // Save updated handlers to localStorage
    this.saveHandlers();
  }

  private matchesPattern(handlerString: string, pattern: string): boolean {
    // Extract URL pattern from handler string for matching
    const urlMatch = handlerString.match(/['"`]([^'"`]+)['"`]/);
    if (urlMatch) {
      const url = urlMatch[1];

      // Support glob-like patterns
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        return new RegExp(regexPattern).test(url);
      }

      return url.includes(pattern);
    }

    return false;
  }

  private sendResponse(response: WSResponse): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    } else {
      console.warn(
        '[MSW Bridge] Cannot send response - WebSocket not connected',
      );
    }
  }

  // Public persistence methods

  loadPersistedHandlers(): void {
    // Only load in development mode
    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV !== 'development'
    ) {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const { handlers, maxHandlers, timestamp } = JSON.parse(stored);

      if (handlers && handlers.length > 0) {
        console.log(
          `[MSW Bridge] Loading ${
            handlers.length
          } persisted handlers from ${new Date(timestamp).toLocaleString()}`,
        );

        // Apply handlers silently (don't persist again to avoid loop)
        const savedPersistEnabled = this.persistEnabled;
        this.persistEnabled = false;
        this.addHandlers(handlers, false);
        this.persistEnabled = savedPersistEnabled;

        // Update limit if specified
        if (maxHandlers !== undefined) {
          this.persistLimit = maxHandlers;
        }
      }
    } catch (error) {
      console.error('[MSW Bridge] Failed to load persisted handlers:', error);
      // Clear corrupted data
      localStorage.removeItem(this.storageKey);
    }
  }

  saveHandlers(): void {
    if (!this.persistEnabled) return;
    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV !== 'development'
    ) {
      return;
    }

    try {
      let handlersToSave = Array.from(this.activeHandlers.keys());

      // Apply limit: keep only N most recent handlers (FIFO)
      if (
        this.persistLimit !== null &&
        handlersToSave.length > this.persistLimit
      ) {
        handlersToSave = handlersToSave.slice(-this.persistLimit);
      }

      const data = {
        handlers: handlersToSave,
        maxHandlers: this.persistLimit,
        timestamp: Date.now(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log(
        `[MSW Bridge] Persisted ${handlersToSave.length} handler(s) (limit: ${
          this.persistLimit || 'unlimited'
        })`,
      );
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        console.error(
          '[MSW Bridge] localStorage quota exceeded, disabling persistence',
        );
        this.persistEnabled = false;
      } else {
        console.error('[MSW Bridge] Failed to persist handlers:', error);
      }
    }
  }

  clearPersistedHandlers(): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('[MSW Bridge] Cleared persisted handlers from localStorage');
    } catch (error) {
      console.error('[MSW Bridge] Failed to clear persisted handlers:', error);
    }
  }
}

export function createMSWBridge(
  worker: any,
  options: MSWBridgeOptions = {},
): MSWWebSocketBridge | null {
  // Only create bridge in development mode
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'development'
  ) {
    console.log(
      '[MSW Bridge] Skipping bridge creation - not in development mode',
    );
    return null;
  }

  return new MSWWebSocketBridge(worker, options);
}
