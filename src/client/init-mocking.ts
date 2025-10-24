import { createMSWBridge, type MSWBridgeOptions } from './websocket-bridge.js';

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
