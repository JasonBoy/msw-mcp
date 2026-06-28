import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'net';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { WebSocket } from 'ws';
import { WSServer } from './server.js';

// WSServer registers SIGINT/SIGTERM/exit listeners per instance.
process.setMaxListeners(50);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Connect a WS client that emulates the browser bridge: it ignores the WELCOME
 * frame and replies with a success/status response for any tool message.
 */
async function connectBrowser(port: number): Promise<WebSocket> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve, reject) => {
        ws.once('open', () => resolve());
        ws.once('error', reject);
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'WELCOME') return;
        ws.send(
          JSON.stringify({
            id: message.id,
            type: message.type === 'GET_STATUS' ? 'STATUS_RESPONSE' : 'SUCCESS',
            activeHandlers: ['GET /api/users'],
            workerStatus: 'running',
          }),
        );
      });

      return ws;
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }
  throw lastError ?? new Error('Could not connect to WSServer');
}

let tmpHome: string;
let server: WSServer | null = null;
let client: WebSocket | null = null;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'msw-server-'));
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
});

afterEach(() => {
  client?.close();
  client = null;
  server?.close();
  server = null;
  vi.restoreAllMocks();
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('WSServer integration', () => {
  it('sends a WELCOME frame to a newly connected client', async () => {
    const port = await getFreePort();
    server = new WSServer(
      port,
      false,
      { persistHandlers: false, persistLimit: null },
      'welcome-test',
      true,
    );

    const ws = new WebSocket(`ws://localhost:${port}`);
    const welcome = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no welcome')), 5000);
      // Retry until the server is listening.
      ws.on('error', () => {});
      ws.on('message', (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()));
      });
    });
    ws.close();

    expect(welcome.type).toBe('WELCOME');
  }, 15000);

  it('round-trips a tool call over HTTP /api/tools/*', async () => {
    const port = await getFreePort();
    server = new WSServer(
      port,
      false,
      { persistHandlers: false, persistLimit: null },
      'tools-test',
      true,
    );
    client = await connectBrowser(port);
    await delay(50);

    const res = await fetch(`http://localhost:${port}/api/tools/add_handlers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ADD_HANDLERS',
        handlers: ["http.get('/api/users', () => HttpResponse.json([]))"],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe('SUCCESS');
    expect(json.activeHandlers).toEqual(['GET /api/users']);
  }, 15000);

  it('reports worker status over HTTP /api/status', async () => {
    const port = await getFreePort();
    server = new WSServer(
      port,
      false,
      { persistHandlers: false, persistLimit: null },
      'status-test',
      true,
    );
    client = await connectBrowser(port);
    await delay(50);

    const res = await fetch(`http://localhost:${port}/api/status`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      connected: true,
      workerStatus: 'running',
      activeHandlers: ['GET /api/users'],
    });
  }, 15000);

  it('returns 404 for unknown routes', async () => {
    const port = await getFreePort();
    server = new WSServer(
      port,
      false,
      { persistHandlers: false, persistLimit: null },
      'notfound-test',
      true,
    );
    await connectBrowser(port);

    const res = await fetch(`http://localhost:${port}/nope`, { method: 'GET' });
    expect(res.status).toBe(404);
  }, 15000);
});
