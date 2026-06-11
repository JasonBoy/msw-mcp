#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WSServer } from '@msw-mcp/core';
import { createMSWAddHandlersTool } from './tools/msw-add-handlers.js';
import { createMSWResetHandlersTool } from './tools/msw-reset-handlers.js';
import { createMSWRemoveHandlersTool } from './tools/msw-remove-handlers.js';
import { createMSWUpdateHandlersTool } from './tools/msw-update-handlers.js';
import { createMSWGetStatusTool } from './tools/msw-get-status.js';
import { createMSWSetupPrompt } from './prompts/msw-setup.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let port = 6789; // default port
  let singleClient = false; // default: broadcast to all clients
  let persistHandlers = true; // default: persist handlers across page refreshes
  let persistLimit: number | null = null; // null = unlimited

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --single-client flag
    if (arg === '--single-client') {
      singleClient = true;
      continue;
    }

    // Handle --no-persist-handlers flag (opt-out)
    if (arg === '--no-persist-handlers') {
      persistHandlers = false;
      persistLimit = null;
      continue;
    }

    // Handle --persist-handlers flag (explicit opt-in, or reset after --no-persist-handlers)
    if (arg === '--persist-handlers') {
      persistHandlers = true;
      persistLimit = null; // unlimited
      continue;
    }

    // Handle --persist-handlers=10 format
    if (arg && arg.startsWith('--persist-handlers=')) {
      persistHandlers = true;
      const parts = arg.split('=');
      const value = parts[1];
      if (value) {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed <= 0) {
          console.error(
            `❌ Invalid --persist-handlers value: ${value} (must be positive integer)`,
          );
          process.exit(1);
        }
        persistLimit = parsed;
      } else {
        console.error('❌ Missing value after --persist-handlers=');
        process.exit(1);
      }
      continue;
    }

    // Handle --mock-ws-port 1234 format
    if (arg === '--mock-ws-port' && i + 1 < args.length) {
      const portStr = args[i + 1];
      if (portStr) {
        const parsedPort = parseInt(portStr, 10);
        if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
          port = parsedPort;
        } else {
          console.error(`❌ Invalid port number: ${portStr}`);
          process.exit(1);
        }
      }
      continue;
    }

    // Handle --mock-ws-port=1234 format
    if (arg && arg.startsWith('--mock-ws-port=')) {
      const parts = arg.split('=');
      const portStr = parts[1];
      if (portStr) {
        const parsedPort = parseInt(portStr, 10);
        if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
          port = parsedPort;
        } else {
          console.error(`❌ Invalid port number: ${portStr}`);
          process.exit(1);
        }
      } else {
        console.error('❌ Missing port number after --mock-ws-port=');
        process.exit(1);
      }
      continue;
    }
  }

  return { port, singleClient, persistHandlers, persistLimit };
}

const { port, singleClient, persistHandlers, persistLimit } = parseArgs();

const server = new McpServer({
  name: 'msw-mcp-server',
  version: '1.0.0',
});

// Initialize WebSocket server for browser communication
const wsServer = new WSServer(port, singleClient, {
  persistHandlers,
  persistLimit,
});

// Register MSW tools
const addHandlersTool = createMSWAddHandlersTool(wsServer);
server.registerTool(
  addHandlersTool.name,
  {
    title: 'Add MSW Handlers',
    description: addHandlersTool.description,
    inputSchema: addHandlersTool.inputSchema,
  },
  addHandlersTool.handler,
);

const resetHandlersTool = createMSWResetHandlersTool(wsServer);
server.registerTool(
  resetHandlersTool.name,
  {
    title: 'Reset MSW Handlers',
    description: resetHandlersTool.description,
    inputSchema: resetHandlersTool.inputSchema,
  },
  resetHandlersTool.handler,
);

const removeHandlersTool = createMSWRemoveHandlersTool(wsServer);
server.registerTool(
  removeHandlersTool.name,
  {
    title: 'Remove MSW Handlers',
    description: removeHandlersTool.description,
    inputSchema: removeHandlersTool.inputSchema,
  },
  removeHandlersTool.handler,
);

const updateHandlersTool = createMSWUpdateHandlersTool(wsServer);
server.registerTool(
  updateHandlersTool.name,
  {
    title: 'Update MSW Handlers',
    description: updateHandlersTool.description,
    inputSchema: updateHandlersTool.inputSchema,
  },
  updateHandlersTool.handler,
);

const getStatusTool = createMSWGetStatusTool(wsServer);
server.registerTool(
  getStatusTool.name,
  {
    title: 'Get MSW Status',
    description: getStatusTool.description,
    inputSchema: getStatusTool.inputSchema,
  },
  getStatusTool.handler,
);

// Register prompts
const setupPrompt = createMSWSetupPrompt();
server.registerPrompt(
  setupPrompt.name,
  {
    // Claude Code currently requires title to be without spaces
    // title: 'Setup MSW Mocking',
    title: 'msw-setup',
    description: setupPrompt.description,
  },
  setupPrompt.getPrompt,
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (wsServer.isServerActive()) {
    console.error(
      `✅ MSW MCP Server running on stdio with WebSocket server on port ${port}`,
    );
  } else {
    console.error(
      `ℹ️  MSW MCP Server running on stdio (WebSocket server on port ${port} is managed by another instance)`,
    );
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('ℹ️  Shutting down MSW MCP Server...');
  wsServer.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('❌ Server error:', error);
  wsServer.close();
  process.exit(1);
});
