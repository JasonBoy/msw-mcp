import { describe, it, expect, vi, afterEach } from 'vitest';
import WebSocket from 'ws';
import { ConnectionManager } from './connection-manager.js';
import type { WSResponse } from './protocol.js';

type Listener = (...args: any[]) => void;

class FakeWS {
  readyState = WebSocket.OPEN;
  sent: string[] = [];
  private listeners: Record<string, Listener> = {};

  send(data: string): void {
    this.sent.push(data);
  }

  on(event: string, cb: Listener): void {
    this.listeners[event] = cb;
  }

  emit(event: string, ...args: any[]): void {
    this.listeners[event]?.(...args);
  }

  lastMessage(): { id: string; type: string } {
    return JSON.parse(this.sent[this.sent.length - 1]!);
  }

  reply(response: Partial<WSResponse>): void {
    const { id } = this.lastMessage();
    this.emit('message', JSON.stringify({ id, ...response }));
  }
}

function asWs(fake: FakeWS): WebSocket {
  return fake as unknown as WebSocket;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ConnectionManager.sendMessage', () => {
  it('rejects when no clients are connected', async () => {
    const cm = new ConnectionManager();
    await expect(
      cm.sendMessage({ id: '', type: 'ADD_HANDLERS' }),
    ).rejects.toThrow('No browser clients connected');
  });

  it('broadcasts to every open client and resolves on a reply', async () => {
    const cm = new ConnectionManager();
    const a = new FakeWS();
    const b = new FakeWS();
    cm.addClient(asWs(a));
    cm.addClient(asWs(b));

    const promise = cm.sendMessage({ id: '', type: 'ADD_HANDLERS' });

    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);

    a.reply({ type: 'SUCCESS', activeHandlers: ['GET /a'] });

    const response = await promise;
    expect(response.type).toBe('SUCCESS');
    expect(response.activeHandlers).toEqual(['GET /a']);
  });

  it('injects persistence config into outgoing messages', async () => {
    const cm = new ConnectionManager(false, {
      persistHandlers: true,
      persistLimit: 5,
    });
    const client = new FakeWS();
    cm.addClient(asWs(client));

    const promise = cm.sendMessage({ id: '', type: 'ADD_HANDLERS' });
    const sent = client.lastMessage() as any;
    expect(sent.persist).toBe(true);
    expect(sent.persistLimit).toBe(5);

    client.reply({ type: 'SUCCESS' });
    await promise;
  });

  it('in single-client mode sends only to the most recent client', async () => {
    const cm = new ConnectionManager(true);
    const a = new FakeWS();
    const b = new FakeWS();
    cm.addClient(asWs(a));
    cm.addClient(asWs(b));

    const promise = cm.sendMessage({ id: '', type: 'ADD_HANDLERS' });
    expect(a.sent).toHaveLength(0);
    expect(b.sent).toHaveLength(1);

    b.reply({ type: 'SUCCESS' });
    await promise;
  });

  it('falls back to an available client when the last client disconnected', async () => {
    const cm = new ConnectionManager(true);
    const a = new FakeWS();
    const b = new FakeWS();
    cm.addClient(asWs(a));
    cm.addClient(asWs(b));
    // Closing b clears the lastClient reference but leaves a connected.
    b.emit('close');

    const promise = cm.sendMessage({ id: '', type: 'ADD_HANDLERS' });
    expect(a.sent).toHaveLength(1);

    a.reply({ type: 'SUCCESS' });
    await promise;
  });

  it('rejects after the 5s timeout when no reply arrives', async () => {
    vi.useFakeTimers();
    const cm = new ConnectionManager();
    cm.addClient(asWs(new FakeWS()));

    const promise = cm.sendMessage({ id: '', type: 'ADD_HANDLERS' });
    const assertion = expect(promise).rejects.toThrow('Request timeout');
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('ignores malformed messages from clients', async () => {
    const cm = new ConnectionManager();
    const client = new FakeWS();
    cm.addClient(asWs(client));

    expect(() => client.emit('message', 'not-json')).not.toThrow();
  });
});

describe('ConnectionManager.getStatus', () => {
  it('reports disconnected when there are no clients', async () => {
    const cm = new ConnectionManager();
    await expect(cm.getStatus()).resolves.toEqual({
      connected: false,
      workerStatus: 'unknown',
      activeHandlers: [],
    });
  });

  it('reports the worker status from a connected client', async () => {
    const cm = new ConnectionManager();
    const client = new FakeWS();
    cm.addClient(asWs(client));

    const promise = cm.getStatus();
    client.reply({
      type: 'STATUS_RESPONSE',
      workerStatus: 'running',
      activeHandlers: ['GET /a'],
    });

    await expect(promise).resolves.toEqual({
      connected: true,
      workerStatus: 'running',
      activeHandlers: ['GET /a'],
    });
  });

  it('returns unknown status when the status request times out', async () => {
    vi.useFakeTimers();
    const cm = new ConnectionManager();
    cm.addClient(asWs(new FakeWS()));

    const promise = cm.getStatus();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).resolves.toEqual({
      connected: true,
      workerStatus: 'unknown',
      activeHandlers: [],
    });
  });
});

describe('ConnectionManager.hasConnectedClients', () => {
  it('tracks client add and close lifecycle', () => {
    const cm = new ConnectionManager();
    expect(cm.hasConnectedClients()).toBe(false);

    const client = new FakeWS();
    cm.addClient(asWs(client));
    expect(cm.hasConnectedClients()).toBe(true);

    client.emit('close');
    expect(cm.hasConnectedClients()).toBe(false);
  });
});
