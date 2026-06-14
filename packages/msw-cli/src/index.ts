#!/usr/bin/env node

import { Command } from 'commander';
import {
  SessionManager,
  type SessionInfo,
  loadMswSetupPrompt,
} from '@msw-mcp/core';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const DEFAULT_PORT = 6789;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command();
const sessionManager = new SessionManager();

program
  .name('msw-cli')
  .description(
    'A command-line interface for AI agents to dynamically update Mock Service Worker (MSW) handlers.',
  )
  .version(packageJson.version)
  .option(
    '-s, --session <name>',
    'Session name (defaults to current directory name)',
  );

function getDaemonPath(): string {
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

  return daemonPath;
}

function printSessionNotOpen(sessionName: string): void {
  console.error(`## Session not open
No active MSW daemon for session **${sessionName}**.

Run first:
  msw-cli open
  # or: msw-cli open -s <name> --port <port>

Then retry your command.

💡 AI Instruction:
Open an MSW session before running handler commands. Use \`msw-cli open\` (optionally with \`--port\` matching the app's WebSocket config).`);
}

function requireOpenSession(sessionName: string): SessionInfo {
  const session = sessionManager.getSession(sessionName);
  if (!session) {
    printSessionNotOpen(sessionName);
    process.exit(1);
  }
  return session;
}

function printSessionOpened(
  session: SessionInfo,
  options: { requestedPort?: number; alreadyOpen: boolean },
): void {
  const wsUrl = `ws://127.0.0.1:${session.port}`;
  const portNote =
    !options.requestedPort && session.port !== DEFAULT_PORT
      ? `\n\n> Port ${DEFAULT_PORT} was in use. Update your app's MSW bridge to use port **${session.port}**.`
      : '';

  const statusLine = options.alreadyOpen
    ? 'Session already open'
    : 'MSW session opened';

  console.log(`## ${statusLine}
- **Session**: ${session.name}
- **Port**: ${session.port}
- **WebSocket**: ${wsUrl}
- **CWD**: ${session.cwd}

Update your app's MSW bridge to use the WebSocket URL above.${portNote}`);
}

interface DaemonOptions {
  port?: number | undefined;
  singleClient?: boolean | undefined;
  persistHandlers?: boolean | undefined;
  persistLimit?: number | null | undefined;
}

async function startDaemon(
  sessionName: string,
  options: DaemonOptions = {},
): Promise<SessionInfo> {
  const daemonPath = getDaemonPath();
  const { port, singleClient, persistHandlers, persistLimit } = options;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MSW_SESSION_NAME: sessionName,
  };

  if (port !== undefined) {
    env.MSW_PORT = String(port);
    env.MSW_STRICT_PORT = 'true';
  }

  if (singleClient) {
    env.MSW_SINGLE_CLIENT = 'true';
  }

  if (persistHandlers) {
    env.MSW_PERSIST_HANDLERS = 'true';
  }

  if (persistLimit != null) {
    env.MSW_PERSIST_LIMIT = String(persistLimit);
  }

  const child = spawn('node', [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env,
  });

  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const session = sessionManager.getSession(sessionName);
    if (session) {
      return session;
    }
  }

  if (port !== undefined) {
    console.error(
      `❌ Failed to start daemon on port ${port}. The port may already be in use.`,
    );
  } else {
    console.error('❌ Failed to start daemon');
  }
  process.exit(1);
}

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'ALL',
];

/**
 * Split an optional leading HTTP method token off each pattern (so a copied
 * status line like 'GET /api/users' is understood as method=GET +
 * pattern '/api/users'), and merge those with any explicit --method flags.
 */
function parsePatternsAndMethods(
  patterns: string[],
  methodFlags?: string[],
): { patterns: string[]; methods: string[] | undefined } {
  const methods = new Set<string>();
  for (const method of methodFlags ?? []) {
    methods.add(method.toUpperCase());
  }

  const cleanedPatterns = patterns.map((pattern) => {
    const match = pattern.match(/^([A-Za-z]+)\s+(.+)$/);
    const leadingToken = match?.[1];
    const remainder = match?.[2];
    if (
      leadingToken &&
      remainder &&
      HTTP_METHODS.includes(leadingToken.toUpperCase())
    ) {
      methods.add(leadingToken.toUpperCase());
      return remainder.trim();
    }
    return pattern;
  });

  return {
    patterns: cleanedPatterns,
    methods: methods.size > 0 ? Array.from(methods) : undefined,
  };
}

function formatSuccess(type: string, data: Record<string, any>): string {
  const handlerCount = Array.isArray(data.activeHandlers)
    ? data.activeHandlers.length
    : 0;

  if (type === 'REMOVE_HANDLERS' && typeof data.removedCount === 'number') {
    if (data.removedCount === 0) {
      return `⚠️ Removed 0 handlers — no active handler matched the pattern(s). Patterns match the handler URL only (substring or * glob); drop any HTTP method prefix or use -m/--method to filter by method. Active handlers: ${handlerCount}`;
    }
    return `✅ Removed ${data.removedCount} handler(s). Active handlers: ${handlerCount}`;
  }

  if (type === 'UPDATE_HANDLERS' && typeof data.matchedCount === 'number') {
    const added = typeof data.addedCount === 'number' ? data.addedCount : 0;
    if (data.matchedCount === 0) {
      return `⚠️ 0 handlers matched — added ${added} new handler(s) (behaved like 'add'). If you meant to replace an existing handler, the pattern did not match: patterns match the handler URL only; drop any HTTP method prefix or use -m/--method. Active handlers: ${handlerCount}`;
    }
    return `✅ Updated: replaced ${data.matchedCount} handler(s) with ${added} new. Active handlers: ${handlerCount}`;
  }

  return `✅ ${data.message || `Success. Active handlers: ${handlerCount}`}`;
}

async function executeCommand(type: string, payload: Record<string, unknown>) {
  const options = program.opts();
  const sessionName = options.session || SessionManager.getDefaultSessionName();

  const session = requireOpenSession(sessionName);

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
    if (data.status === 'success' || data.type === 'SUCCESS') {
      console.log(formatSuccess(type, data));
    } else {
      console.error(`❌ Error: ${data.error || 'Unknown error'}`);
      console.error(
        `\n💡 AI Instruction:\nThe command failed. Ensure your handler syntax is valid and returns a Response, such as HttpResponse.json(...).`,
      );
      process.exit(1);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to connect to daemon: ${message}`);
    process.exit(1);
  }
}

program
  .command('setup')
  .description(
    'Print MSW project setup instructions (scaffold mocks, client bridge, env)',
  )
  .option('--framework <framework>', 'Framework hint (default: auto-detect)')
  .option(
    '--service-worker-path <path>',
    'Default service worker URL path (default: /mockServiceWorker.js)',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ msw-cli setup
  $ msw-cli setup --framework vite
`,
  )
  .action((options: { framework?: string; serviceWorkerPath?: string }) => {
    console.log(
      loadMswSetupPrompt({
        ...(options.framework !== undefined
          ? { framework: options.framework }
          : {}),
        ...(options.serviceWorkerPath !== undefined
          ? { serviceWorkerPath: options.serviceWorkerPath }
          : {}),
      }),
    );
  });

program
  .command('open')
  .description(
    'Open an MSW daemon session. Must be run before add, update, remove, reset, or status.',
  )
  .option(
    '--port <port>',
    'Port to bind (must match app WebSocket config; fails if in use)',
    (value) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`Invalid port number: ${value}`);
      }
      return parsed;
    },
  )
  .option(
    '--single-client',
    'Only broadcast to the most recently connected tab',
  )
  .option(
    '--persist-handlers [limit]',
    'Persist handlers across page refreshes (enabled by default; optionally limit to N most recent)',
    true,
  )
  .addHelpText(
    'after',
    `
Examples:
  $ msw-cli open
  $ msw-cli open --port 6789
  $ msw-cli open -s my-app --port 6789
  $ msw-cli open --no-persist-handlers
  $ msw-cli open --persist-handlers 10
  $ msw-cli open --single-client
`,
  )
  .action(
    async (options: {
      port?: number;
      singleClient?: boolean;
      persistHandlers?: boolean | string;
    }) => {
      const programOptions = program.opts();
      const sessionName =
        programOptions.session || SessionManager.getDefaultSessionName();

      const persistHandlers = options.persistHandlers !== false;
      let persistLimit: number | null = null;

      if (typeof options.persistHandlers === 'string') {
        const parsed = parseInt(options.persistHandlers, 10);
        if (isNaN(parsed) || parsed <= 0) {
          console.error(
            `❌ Invalid --persist-handlers value: ${options.persistHandlers} (must be a positive integer)`,
          );
          process.exit(1);
        }
        persistLimit = parsed;
      }

      const existing = sessionManager.getSession(sessionName);
      if (existing) {
        if (options.port !== undefined && existing.port !== options.port) {
          console.error(
            `❌ Session "${sessionName}" is already open on port ${existing.port}. Close it first with \`msw-cli close\`.`,
          );
          process.exit(1);
        }
        printSessionOpened(existing, {
          ...(options.port !== undefined
            ? { requestedPort: options.port }
            : {}),
          alreadyOpen: true,
        });
        return;
      }

      const session = await startDaemon(sessionName, {
        port: options.port,
        singleClient: options.singleClient,
        persistHandlers,
        persistLimit,
      });
      printSessionOpened(session, {
        ...(options.port !== undefined ? { requestedPort: options.port } : {}),
        alreadyOpen: false,
      });
    },
  );

program
  .command('add <handlers...>')
  .description(
    'Add new MSW handlers. Handlers must be valid JS code strings returning a valid Response using HttpResponse.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ msw-cli open
  $ msw-cli add "http.get('/api/user', () => HttpResponse.json({ id: 1 }))"
`,
  )
  .action((handlers) => {
    executeCommand('ADD_HANDLERS', { handlers });
  });

program
  .command('update <patterns...>')
  .description(
    'Update existing MSW handlers that match specified URL patterns.',
  )
  .requiredOption('-h, --handlers <handlers...>', 'New handlers code strings')
  .option(
    '-m, --method <methods...>',
    'Filter matched handlers by HTTP method(s), e.g. GET POST',
  )
  .addHelpText(
    'after',
    `
Patterns match the handler URL only (substring or * glob) — NOT the HTTP method.
Do not paste the "METHOD URL" line from \`status\` as-is unless you want that
method filtered: a leading method token (e.g. "GET ") is auto-split into a
method filter. To target a method explicitly, use -m/--method.

Reports how many handlers matched. If 0 match, the new handler is still added
(behaves like \`add\`) and a warning is printed — fix the pattern to replace.

Examples:
  $ msw-cli open
  $ msw-cli update "/api/user" -h "http.get('/api/user', () => HttpResponse.json({ id: 2 }))"
  $ msw-cli update "/api/user" -m GET -h "http.get('/api/user', () => HttpResponse.json({ id: 2 }))"
`,
  )
  .action((patterns, options) => {
    const { patterns: parsedPatterns, methods } = parsePatternsAndMethods(
      patterns,
      options.method,
    );
    executeCommand('UPDATE_HANDLERS', {
      patterns: parsedPatterns,
      handlers: options.handlers,
      ...(methods ? { methods } : {}),
    });
  });

program
  .command('remove <patterns...>')
  .description('Remove MSW handlers matching specified URL patterns.')
  .option(
    '-m, --method <methods...>',
    'Filter matched handlers by HTTP method(s), e.g. GET POST',
  )
  .addHelpText(
    'after',
    `
Patterns match the handler URL only (substring or * glob) — NOT the HTTP method.
Do not paste the "METHOD URL" line from \`status\` as-is unless you want that
method filtered: a leading method token (e.g. "GET ") is auto-split into a
method filter. To target a method explicitly, use -m/--method.

Reports how many handlers were removed. "Removed 0" means the pattern matched
nothing — fix the pattern (drop the method prefix) and retry.

Examples:
  $ msw-cli open
  $ msw-cli remove "/api/user"
  $ msw-cli remove "*/api/v1/users/*"
  $ msw-cli remove "/api/user" -m GET
`,
  )
  .action((patterns, options) => {
    const { patterns: parsedPatterns, methods } = parsePatternsAndMethods(
      patterns,
      options.method,
    );
    executeCommand('REMOVE_HANDLERS', {
      patterns: parsedPatterns,
      ...(methods ? { methods } : {}),
    });
  });

program
  .command('reset [handlers...]')
  .description(
    'Reset MSW handlers. If no handlers are provided, removes all runtime handlers and keeps only initial ones.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ msw-cli open
  $ msw-cli reset
`,
  )
  .action((handlers) => {
    executeCommand('RESET_HANDLERS', {
      handlers: handlers.length > 0 ? handlers : undefined,
    });
  });

program
  .command('status')
  .description('Get MSW status (requires an open session)')
  .action(async () => {
    const options = program.opts();
    const sessionName =
      options.session || SessionManager.getDefaultSessionName();
    const session = requireOpenSession(sessionName);

    try {
      const response = await fetch(
        `http://127.0.0.1:${session.port}/api/status`,
        {
          method: 'POST',
        },
      );
      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to get status: ${message}`);
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
      } catch {
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
      } catch {
        console.error(
          `⚠️ Could not kill process ${session.pid} for session ${session.name}`,
        );
      }
      sessionManager.removeSession(session.name);
    }
  });

// Commander only allows one short flag per option, so the default version
// option registers `-V`. Accept lowercase `-v` as a top-level alias too.
if (process.argv[2] === '-v') {
  console.log(packageJson.version);
  process.exit(0);
}

program.parse(process.argv);
