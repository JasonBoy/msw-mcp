#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WSServer } from './websocket/server.js';
import { createMSWAddHandlersTool } from './tools/msw-add-handlers.js';
import { createMSWResetHandlersTool } from './tools/msw-reset-handlers.js';
import { createMSWRemoveHandlersTool } from './tools/msw-remove-handlers.js';
import { createMSWGetStatusTool } from './tools/msw-get-status.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let port = 6789; // default port

  for (let i = 0; i < args.length; i++) {
    // Handle --mock-ws-port 1234 format
    if (args[i] === '--mock-ws-port' && i + 1 < args.length) {
      const portStr = args[i + 1];
      if (portStr) {
        const parsedPort = parseInt(portStr, 10);
        if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
          port = parsedPort;
        } else {
          console.error(`Invalid port number: ${portStr}`);
          process.exit(1);
        }
      }
      break;
    }
    // Handle --mock-ws-port=1234 format
    const arg = args[i];
    if (arg && arg.startsWith('--mock-ws-port=')) {
      const parts = arg.split('=');
      const portStr = parts[1];
      if (portStr) {
        const parsedPort = parseInt(portStr, 10);
        if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
          port = parsedPort;
        } else {
          console.error(`Invalid port number: ${portStr}`);
          process.exit(1);
        }
      } else {
        console.error('Missing port number after --mock-ws-port=');
        process.exit(1);
      }
      break;
    }
  }

  return { port };
}

const { port } = parseArgs();

const server = new McpServer({
  name: 'msw-mcp-server',
  version: '1.0.0',
});

// Initialize WebSocket server for browser communication
const wsServer = new WSServer(port);
const connectionManager = wsServer.getConnectionManager();

// Register MSW tools
const addHandlersTool = createMSWAddHandlersTool(connectionManager);
server.registerTool(
  addHandlersTool.name,
  {
    title: 'Add MSW Handlers',
    description: addHandlersTool.description,
    inputSchema: addHandlersTool.inputSchema,
  },
  addHandlersTool.handler,
);

const resetHandlersTool = createMSWResetHandlersTool(connectionManager);
server.registerTool(
  resetHandlersTool.name,
  {
    title: 'Reset MSW Handlers',
    description: resetHandlersTool.description,
    inputSchema: resetHandlersTool.inputSchema,
  },
  resetHandlersTool.handler,
);

const removeHandlersTool = createMSWRemoveHandlersTool(connectionManager);
server.registerTool(
  removeHandlersTool.name,
  {
    title: 'Remove MSW Handlers',
    description: removeHandlersTool.description,
    inputSchema: removeHandlersTool.inputSchema,
  },
  removeHandlersTool.handler,
);

const getStatusTool = createMSWGetStatusTool(connectionManager);
server.registerTool(
  getStatusTool.name,
  {
    title: 'Get MSW Status',
    description: getStatusTool.description,
    inputSchema: getStatusTool.inputSchema,
  },
  getStatusTool.handler,
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `MSW MCP Server running on stdio with WebSocket server on port ${port}`,
  );
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('Shutting down MSW MCP Server...');
  wsServer.close();
  process.exit(0);
});

main().catch((error) => {
  console.error('Server error:', error);
  wsServer.close();
  process.exit(1);
});
