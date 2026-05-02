import path from 'path';
import fs from 'fs';
import os from 'os';

export interface SessionInfo {
  name: string;
  port: number;
  pid: number;
  cwd: string;
  startTime: number;
}

export class SessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), '.msw-mcp', 'sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionPath(name: string): string {
    return path.join(this.sessionsDir, `${name}.json`);
  }

  registerSession(info: SessionInfo): void {
    const sessionPath = this.getSessionPath(info.name);
    fs.writeFileSync(sessionPath, JSON.stringify(info, null, 2));
  }

  removeSession(name: string): void {
    const sessionPath = this.getSessionPath(name);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  }

  getSession(name: string): SessionInfo | null {
    const sessionPath = this.getSessionPath(name);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      const data = JSON.parse(
        fs.readFileSync(sessionPath, 'utf8'),
      ) as SessionInfo;
      // Check if process is still running
      try {
        process.kill(data.pid, 0);
        return data;
      } catch (e) {
        // Process is dead, remove session file
        this.removeSession(name);
        return null;
      }
    } catch (e) {
      this.removeSession(name);
      return null;
    }
  }

  listSessions(): SessionInfo[] {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.sessionsDir);
    const sessions: SessionInfo[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const name = path.basename(file, '.json');
        const session = this.getSession(name);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions;
  }

  static getDefaultSessionName(cwd: string = process.cwd()): string {
    return path.basename(cwd) || 'default';
  }
}
