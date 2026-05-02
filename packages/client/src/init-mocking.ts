import { createMSWBridge, type MSWBridgeOptions } from './websocket-bridge.js';

async function ensureMSWGlobals(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const globalScope = window as unknown as {
    msw?: Record<string, unknown>;
  };

  const hasRequiredExports = Boolean(
    globalScope.msw && (globalScope.msw.http || globalScope.msw.HttpResponse),
  );

  if (hasRequiredExports) {
    return;
  }

  try {
    const mswExports = (await import('msw')) as Record<string, unknown>;

    // Preserve any existing values while ensuring the required exports are present.
    globalScope.msw = {
      ...(globalScope.msw || {}),
      ...mswExports,
      http: mswExports.http ?? globalScope.msw?.http,
      HttpResponse: mswExports.HttpResponse ?? globalScope.msw?.HttpResponse,
      bypass: mswExports.bypass ?? globalScope.msw?.bypass,
      passthrough: mswExports.passthrough ?? globalScope.msw?.passthrough,
      delay: mswExports.delay ?? globalScope.msw?.delay,
    };

    console.log('[MSW] Exposed MSW exports on window for dynamic handlers');
  } catch (error) {
    console.warn('[MSW] Failed to expose MSW exports on window:', error);
  }
}

export interface InitMockingOptions {
  worker: any; // MSW worker instance (required)
  wsEnabled?: boolean; // Enable WebSocket bridge (default: true)
  wsBridgeOptions?: MSWBridgeOptions; // WebSocket bridge configuration
  workerOptions?: {
    // MSW worker.start() options
    onUnhandledRequest?: 'warn' | 'error' | 'bypass';
    quiet?: boolean;
    serviceWorker?: {
      url: string;
    };
  };
}

export async function initMocking(options: InitMockingOptions): Promise<any> {
  // Only run in development mode
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'development'
  ) {
    return;
  }

  const {
    worker,
    wsEnabled = true,
    wsBridgeOptions = {},
    workerOptions = {},
  } = options;

  if (!worker) {
    throw new Error('MSW worker is required');
  }

  // Start MSW worker
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false,
    ...workerOptions,
  });

  console.log('[MSW] Service worker started');

  // Initialize WebSocket bridge if enabled
  if (wsEnabled) {
    try {
      await ensureMSWGlobals();

      const bridge = createMSWBridge(worker, wsBridgeOptions);

      if (bridge && typeof window !== 'undefined') {
        (window as any).__mswBridge = bridge;
        console.log('[MSW] WebSocket bridge initialized for AI integration');
      }
    } catch (error) {
      console.warn('[MSW] Failed to initialize WebSocket bridge:', error);
    }
  } else {
    console.log('[MSW] WebSocket bridge disabled');
  }

  return worker;
}
