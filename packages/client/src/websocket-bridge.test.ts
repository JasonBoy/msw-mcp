import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MSWWebSocketBridge } from './websocket-bridge.js';

interface FakeWorker {
  use: ReturnType<typeof vi.fn>;
  resetHandlers: ReturnType<typeof vi.fn>;
}

function makeWorker(): FakeWorker {
  return { use: vi.fn(), resetHandlers: vi.fn() };
}

function makeMsw() {
  const makeHandler = () => ({ resolver: () => {} });
  return {
    http: {
      get: makeHandler,
      post: makeHandler,
      put: makeHandler,
      delete: makeHandler,
      patch: makeHandler,
      options: makeHandler,
      head: makeHandler,
      all: makeHandler,
    },
    HttpResponse: { json: () => ({}) },
    bypass: (req: unknown) => req,
    passthrough: () => ({}),
    delay: () => Promise.resolve(),
  };
}

function newBridge(worker: FakeWorker): any {
  return new MSWWebSocketBridge(worker as unknown as any, { enabled: false });
}

/** Drives a message through the bridge and captures the response it would send. */
function dispatch(bridge: any, message: Record<string, unknown>): any {
  const captured: any[] = [];
  const spy = vi.spyOn(bridge, 'sendResponse').mockImplementation((r: any) => {
    captured.push(r);
  });
  bridge.handleMessage(message);
  spy.mockRestore();
  return captured[0];
}

beforeEach(() => {
  (window as any).msw = makeMsw();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).msw;
});

describe('extractHandlerInfo', () => {
  it('extracts the method and path from a handler string', () => {
    const bridge = newBridge(makeWorker());
    expect(bridge.extractHandlerInfo("http.get('/api/users', () => {})")).toBe(
      'GET /api/users',
    );
  });

  it('falls back to UNKNOWN for unrecognized handler strings', () => {
    const bridge = newBridge(makeWorker());
    expect(bridge.extractHandlerInfo('something else')).toBe('UNKNOWN unknown');
  });
});

describe('matchesPattern', () => {
  it('matches by substring', () => {
    const bridge = newBridge(makeWorker());
    expect(
      bridge.matchesPattern("http.get('/api/users', () => {})", 'users'),
    ).toBe(true);
  });

  it('supports glob-style wildcards', () => {
    const bridge = newBridge(makeWorker());
    expect(
      bridge.matchesPattern(
        "http.get('/api/v1/users', () => {})",
        '/api/*/users',
      ),
    ).toBe(true);
  });

  it('returns false when no URL is present in the handler string', () => {
    const bridge = newBridge(makeWorker());
    expect(bridge.matchesPattern('http.get(noUrlHere)', 'users')).toBe(false);
  });
});

describe('handleMessage routing', () => {
  it('resets the reconnect counter on WELCOME without responding', () => {
    const bridge = newBridge(makeWorker());
    bridge.reconnectAttempts = 4;
    const response = dispatch(bridge, { id: '1', type: 'WELCOME' });
    expect(response).toBeUndefined();
    expect(bridge.reconnectAttempts).toBe(0);
  });

  it('adds handlers and reports active handlers', () => {
    const worker = makeWorker();
    const bridge = newBridge(worker);

    const response = dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
    });

    expect(worker.use).toHaveBeenCalledTimes(1);
    expect(response.type).toBe('SUCCESS');
    expect(response.activeHandlers).toEqual(['GET /api/users']);
  });

  it('marks handlers as one-time when once is set', () => {
    const worker = makeWorker();
    const bridge = newBridge(worker);

    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
      once: true,
    });

    const keys = Array.from(bridge.activeHandlers.keys()) as string[];
    expect(keys[0]).toContain('{ once: true }');
  });

  it('resets handlers and clears tracking', () => {
    const worker = makeWorker();
    const bridge = newBridge(worker);
    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
    });

    const response = dispatch(bridge, { id: '2', type: 'RESET_HANDLERS' });

    expect(worker.resetHandlers).toHaveBeenCalled();
    expect(bridge.activeHandlers.size).toBe(0);
    expect(response.activeHandlers).toEqual([]);
  });

  it('removes handlers matching a pattern and reports the count', () => {
    const worker = makeWorker();
    const bridge = newBridge(worker);
    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      handlers: [
        "http.get('/api/users', () => HttpResponse.json([]))",
        "http.get('/api/posts', () => HttpResponse.json([]))",
      ],
    });

    const response = dispatch(bridge, {
      id: '2',
      type: 'REMOVE_HANDLERS',
      patterns: ['/api/users'],
    });

    expect(response.removedCount).toBe(1);
    expect(response.activeHandlers).toEqual(['GET /api/posts']);
  });

  it('respects the method filter when removing handlers', () => {
    const worker = makeWorker();
    const bridge = newBridge(worker);
    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      handlers: [
        "http.get('/api/users', () => HttpResponse.json([]))",
        "http.post('/api/users', () => HttpResponse.json({}))",
      ],
    });

    const response = dispatch(bridge, {
      id: '2',
      type: 'REMOVE_HANDLERS',
      patterns: ['/api/users'],
      methods: ['POST'],
    });

    expect(response.removedCount).toBe(1);
    expect(response.activeHandlers).toEqual(['GET /api/users']);
  });

  it('updates handlers and reports matched + added counts', () => {
    const worker = makeWorker();
    const bridge = newBridge(worker);
    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
    });

    const response = dispatch(bridge, {
      id: '2',
      type: 'UPDATE_HANDLERS',
      patterns: ['/api/users'],
      handlers: [
        "http.get('/api/users', () => HttpResponse.json([{ id: 1 }]))",
      ],
    });

    expect(response.matchedCount).toBe(1);
    expect(response.addedCount).toBe(1);
  });

  it('responds to GET_STATUS with a STATUS_RESPONSE', () => {
    const bridge = newBridge(makeWorker());
    const response = dispatch(bridge, { id: '1', type: 'GET_STATUS' });
    expect(response.type).toBe('STATUS_RESPONSE');
    expect(response.workerStatus).toBe('running');
  });

  it('returns an ERROR response for an unknown message type', () => {
    const bridge = newBridge(makeWorker());
    const response = dispatch(bridge, { id: '1', type: 'NONSENSE' });
    expect(response.type).toBe('ERROR');
    expect(response.error).toContain('Unknown message type');
  });
});

describe('persistence', () => {
  const STORAGE_KEY = 'msw_dynamic_handlers';
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('persists handlers to localStorage when enabled', () => {
    const bridge = newBridge(makeWorker());
    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      persist: true,
      handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.handlers).toHaveLength(1);
  });

  it('enforces the persistence limit (keeps the most recent)', () => {
    const bridge = newBridge(makeWorker());
    dispatch(bridge, {
      id: '1',
      type: 'ADD_HANDLERS',
      persist: true,
      persistLimit: 1,
      handlers: [
        "http.get('/api/users', () => HttpResponse.json([]))",
        "http.get('/api/posts', () => HttpResponse.json([]))",
      ],
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.handlers).toHaveLength(1);
    expect(stored.handlers[0]).toContain('/api/posts');
  });

  it('loads persisted handlers on construction', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
        maxHandlers: null,
        timestamp: Date.now(),
      }),
    );

    const bridge = newBridge(makeWorker());
    expect(bridge.activeHandlers.size).toBe(1);
  });

  it('clears corrupted persisted data on load', () => {
    localStorage.setItem(STORAGE_KEY, '{ corrupt');
    newBridge(makeWorker());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearPersistedHandlers removes the stored entry', () => {
    const bridge = newBridge(makeWorker());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ handlers: [] }));
    bridge.clearPersistedHandlers();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
