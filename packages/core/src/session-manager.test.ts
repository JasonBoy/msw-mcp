import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SessionManager, type SessionInfo } from './session-manager.js';

let tmpHome: string;

function makeSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    name: 'demo',
    port: 6789,
    pid: process.pid,
    cwd: '/tmp/demo',
    startTime: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'msw-session-'));
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('SessionManager', () => {
  it('creates the sessions directory on construction', () => {
    new SessionManager();
    expect(fs.existsSync(path.join(tmpHome, '.msw-cli', 'sessions'))).toBe(
      true,
    );
  });

  it('registers and retrieves a live session', () => {
    const manager = new SessionManager();
    const info = makeSession();
    manager.registerSession(info);

    expect(manager.getSession('demo')).toEqual(info);
  });

  it('returns null for an unknown session', () => {
    const manager = new SessionManager();
    expect(manager.getSession('nope')).toBeNull();
  });

  it('prunes sessions whose process is no longer running', () => {
    const manager = new SessionManager();
    // PID 1 is init/launchd; process.kill(pid, 0) on a non-existent high PID throws ESRCH.
    manager.registerSession(makeSession({ name: 'dead', pid: 2 ** 30 }));

    const sessionPath = path.join(tmpHome, '.msw-cli', 'sessions', 'dead.json');
    expect(fs.existsSync(sessionPath)).toBe(true);

    expect(manager.getSession('dead')).toBeNull();
    expect(fs.existsSync(sessionPath)).toBe(false);
  });

  it('removes and cleans up a corrupted session file', () => {
    const manager = new SessionManager();
    const sessionPath = path.join(tmpHome, '.msw-cli', 'sessions', 'bad.json');
    fs.writeFileSync(sessionPath, '{ not valid json');

    expect(manager.getSession('bad')).toBeNull();
    expect(fs.existsSync(sessionPath)).toBe(false);
  });

  it('removeSession deletes the file and is a no-op when missing', () => {
    const manager = new SessionManager();
    manager.registerSession(makeSession({ name: 'temp' }));
    manager.removeSession('temp');
    expect(manager.getSession('temp')).toBeNull();
    expect(() => manager.removeSession('temp')).not.toThrow();
  });

  it('lists only live sessions', () => {
    const manager = new SessionManager();
    manager.registerSession(makeSession({ name: 'alive', pid: process.pid }));
    manager.registerSession(makeSession({ name: 'gone', pid: 2 ** 30 }));

    const names = manager.listSessions().map((s) => s.name);
    expect(names).toEqual(['alive']);
  });

  it('returns an empty list when the sessions dir does not exist', () => {
    const manager = new SessionManager();
    fs.rmSync(path.join(tmpHome, '.msw-cli', 'sessions'), {
      recursive: true,
      force: true,
    });
    expect(manager.listSessions()).toEqual([]);
  });

  it('derives the default session name from the directory basename', () => {
    expect(SessionManager.getDefaultSessionName('/a/b/my-app')).toBe('my-app');
  });
});
