import { WSServer } from './server.js';
import { SessionManager } from './session-manager.js';

// Parse arguments from environment or command line
const port = parseInt(process.env.MSW_PORT || '6789', 10);
const singleClient = process.env.MSW_SINGLE_CLIENT === 'true';
const persistHandlers = process.env.MSW_PERSIST_HANDLERS === 'true';
const persistLimit = process.env.MSW_PERSIST_LIMIT
  ? parseInt(process.env.MSW_PERSIST_LIMIT, 10)
  : null;
const sessionName =
  process.env.MSW_SESSION_NAME || SessionManager.getDefaultSessionName();
const strictPort = process.env.MSW_STRICT_PORT === 'true';

console.error(`🚀 Starting MSW Daemon for session: ${sessionName}`);

const server = new WSServer(
  port,
  singleClient,
  {
    persistHandlers,
    persistLimit,
  },
  sessionName,
  strictPort,
);

// Keep the process alive
process.stdin.resume();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});
