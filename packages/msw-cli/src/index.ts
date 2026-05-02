#!/usr/bin/env node

import { Command } from 'commander';
import { SessionManager, type SessionInfo } from '@msw-mcp/core';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const program = new Command();
const sessionManager = new SessionManager();

program
  .name('msw-cli')
  .description('Command-line interface for MSW MCP')
  .version('1.0.0')
  .option(
    '-s, --session <name>',
    'Session name (defaults to current directory name)',
  );

// Helper to spawn daemon
async function ensureDaemon(sessionName: string): Promise<SessionInfo> {
  let session = sessionManager.getSession(sessionName);
  if (session) {
    return session;
  }

  console.log(`Starting MSW daemon for session: ${sessionName}...`);

  // Resolve core daemon path
  const __filename = fileURLToPath(import.meta.url);
  const corePackageDir = path.dirname(
    import.meta.resolve('@msw-mcp/core/package.json').replace('file://', ''),
  );
  const daemonPath = path.join(corePackageDir, 'build', 'daemon.js');

  if (!fs.existsSync(daemonPath)) {
    console.error(
      `❌ Daemon not found at ${daemonPath}. Please rebuild @msw-mcp/core.`,
    );
    process.exit(1);
  }

  const child = spawn('node', [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      MSW_SESSION_NAME: sessionName,
    },
  });

  child.unref();

  // Wait for session to be registered
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    session = sessionManager.getSession(sessionName);
    if (session) {
      console.log(`✅ Daemon started on port ${session.port}`);
      return session;
    }
  }

  console.error('❌ Failed to start daemon');
  process.exit(1);
}

// Helper to execute command
async function executeCommand(type: string, payload: any) {
  const options = program.opts();
  const sessionName = options.session || SessionManager.getDefaultSessionName();

  const session = await ensureDaemon(sessionName);

  try {
    const response = await fetch(
      `http://127.0.0.1:${session.port}/api/tools/${type}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload }),
      },
    );

    const data = await response.json();
    if (data.status === 'success') {
      console.log(`✅ Success: ${data.message || 'Operation completed'}`);
    } else {
      console.error(`❌ Error: ${data.error || 'Unknown error'}`);
      console.error(
        `\n💡 AI Instruction:\nThe command failed. Ensure your handler syntax is valid and you are returning a valid Response using HttpResponse. Also ensure you import any required methods from 'msw'.\nIf you are calling bypass(), ensure you import it from 'msw' and pass it the original request.`,
      );
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Failed to connect to daemon: ${error.message}`);
    process.exit(1);
  }
}

program
  .command('add <handlers...>')
  .description('Add MSW handlers')
  .action((handlers) => {
    executeCommand('addHandlers', { handlers });
  });

program
  .command('update <patterns...>')
  .description('Update MSW handlers')
  .requiredOption('-h, --handlers <handlers...>', 'New handlers code')
  .action((patterns, options) => {
    executeCommand('updateHandlers', { patterns, handlers: options.handlers });
  });

program
  .command('remove <patterns...>')
  .description('Remove MSW handlers')
  .action((patterns) => {
    executeCommand('removeHandlers', { patterns });
  });

program
  .command('reset [handlers...]')
  .description('Reset MSW handlers')
  .action((handlers) => {
    executeCommand('resetHandlers', {
      handlers: handlers.length > 0 ? handlers : undefined,
    });
  });

program
  .command('status')
  .description('Get MSW status')
  .action(async () => {
    const options = program.opts();
    const sessionName =
      options.session || SessionManager.getDefaultSessionName();
    const session = await ensureDaemon(sessionName);

    try {
      const response = await fetch(
        `http://127.0.0.1:${session.port}/api/status`,
        {
          method: 'POST',
        },
      );
      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error(`❌ Failed to get status: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List active sessions')
  .action(() => {
    const sessions = sessionManager.listSessions();
    if (sessions.length === 0) {
      console.log('No active sessions found.');
      return;
    }
    console.table(
      sessions.map((s) => ({
        Name: s.name,
        Port: s.port,
        PID: s.pid,
        CWD: s.cwd,
        Uptime: `${Math.round((Date.now() - s.startTime) / 1000)}s`,
      })),
    );
  });

program
  .command('close [session]')
  .description(
    'Close a specific session (defaults to current directory session)',
  )
  .action((sessionArg) => {
    const options = program.opts();
    const sessionName =
      sessionArg || options.session || SessionManager.getDefaultSessionName();
    const session = sessionManager.getSession(sessionName);

    if (session) {
      try {
        process.kill(session.pid);
        console.log(`✅ Closed session ${sessionName}`);
      } catch (e) {
        console.error(
          `⚠️ Could not kill process ${session.pid}, removing session file.`,
        );
      }
      sessionManager.removeSession(sessionName);
    } else {
      console.log(`No active session found for: ${sessionName}`);
    }
  });

program
  .command('close-all')
  .description('Close all active sessions')
  .action(() => {
    const sessions = sessionManager.listSessions();
    for (const session of sessions) {
      try {
        process.kill(session.pid);
        console.log(`✅ Closed session ${session.name}`);
      } catch (e) {
        console.error(
          `⚠️ Could not kill process ${session.pid} for session ${session.name}`,
        );
      }
      sessionManager.removeSession(session.name);
    }
  });

program.parse(process.argv);
