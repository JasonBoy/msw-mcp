# MSW MCP Server

A Model Context Protocol (MCP) server that enables AI-driven control of [Mock Service Worker (MSW)](https://mswjs.io/) in browser environments. This server acts as a bridge between AI assistants and MSW service workers, allowing dynamic API mocking through intelligent handler generation and real-time updates.

**Demo video and full feature overview** (whole monorepo): see the [repository README](../../README.md#demo).

## Architecture

```
┌─────────────────┐    MCP Protocol    ┌─────────────────────┐    WebSocket    ┌──────────────────┐
│                 │◄──────────────────►│                     │◄───────────────►│                  │
│   AI Assistant  │                    │   MSW MCP Server    │                 │  Browser MSW     │
│   (Claude etc.) │                    │                     │                 │  Service Worker  │
│                 │                    │                     │                 │                  │
└─────────────────┘                    └─────────────────────┘                 └──────────────────┘
```

## Getting Started

### Installation

**Standard configuration (works with most MCP clients):**

```json
{
  "mcpServers": {
    "msw-mcp": {
      "command": "npx",
      "args": ["msw-mcp@latest"]
    }
  }
}
```

**Quick install links for vscode:**

[![Install in VS Code](https://img.shields.io/badge/VS%20Code-Install-blue?logo=visualstudiocode)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522msw-mcp%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522msw-mcp%2540latest%2522%255D%257D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS%20Code%20Insiders-Install-purple?logo=visualstudiocode)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522msw-mcp%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522msw-mcp%2540latest%2522%255D%257D)

**Claude Code:**

Use the Claude Code CLI to add the MSW MCP server:

```bash
claude mcp add msw-mcp npx msw-mcp@latest
```

Also supports: Cursor, Gemini-cli, Windsurf, Cline, Roo Cline, and other MCP-compatible clients.

### Quick Setup

Use the `/msw-setup` prompt in your MCP client to automatically configure your project:

```
/msw-setup
```

This will:

- Auto-detect your framework (React, Vue, Svelte, etc.)
- Install required dependencies (`msw` and `msw-mcp`)
- Create the complete mocks directory structure
- Configure environment variables
- Integrate with your app entry point

<details>
<summary>Manual Setup</summary>

If you prefer manual configuration:

```bash
# Install dependencies
npm install -D msw @msw-mcp/client

# Initialize MSW service worker
npx msw init public/ --save
```

Create `mocks/index.js` (after `mocks/handlers.js` with at least one handler, or use an empty `export const handlers = []`):

```javascript
import { initMocking } from '@msw-mcp/client';
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

const worker = setupWorker(...handlers);

export async function initMocks() {
  if (process.env.NODE_ENV !== 'development') return;

  await initMocking({
    worker,
    wsEnabled: true,
    wsBridgeOptions: {
      url: 'ws://localhost:6789',
    },
  });
}
```

Import in your app entry:

```javascript
import { initMocks } from './mocks';

initMocks().then(() => {
  // Start your app
});
```

</details>

## MCP Tools

### `msw_add_handlers`

Add new request handlers dynamically:

```javascript
// Example usage from AI
'Create a GET /users endpoint that returns a list of users';
// Generates: http.get('/users', () => HttpResponse.json([...]))
```

### `msw_get_status`

Check current MSW status and active handlers.

### `msw_update_handlers`

Update existing handlers by URL pattern and optional HTTP methods (e.g., `methods: ['GET', 'POST']`).

### `msw_remove_handlers`

Remove handlers by URL pattern and optional HTTP methods (e.g., `methods: ['GET']` to remove only GET handlers).

### `msw_reset_handlers`

Reset all handlers to initial state.

See [DOCUMENTATION.md](./DOCUMENTATION.md) for detailed API reference.

## Configuration

### Server Arguments

- `--mock-ws-port=<port>` - WebSocket server port (default: 6789)
- `--persist-handlers` - Save handlers across page refreshes (or `--persist-handlers=10` persists only 10 most recent handlers)
- `--single-client` - Only broadcast to the most recent tab

### Environment Variables for client bridge

> Since they are just envs used in the generated setup code, you can customize them as needed.

Create `.env.local`:

```bash
ENABLE_MSW_MOCK=true
ENABLE_MSW_WS_MOCK=true
MCP_SERVER_URL=ws://localhost:6789
```

## Usage Examples

**Generate a REST API:**

```
"Create a REST API for user management with CRUD operations"
```

**Mock external APIs:**

```
"Mock the GitHub API to return fake repository data"
```

**Test error scenarios:**

```
"Make the /users endpoint return a 500 error"
```

## Development

```bash
npm run build     # Build TypeScript
npm run dev       # Build and run
npm run start     # Run built server
```

## Documentation

For detailed documentation including:

- Complete API reference
- WebSocket protocol details
- Advanced configuration options
- Frontend integration guide
- Debugging tips

See [DOCUMENTATION.md](./DOCUMENTATION.md)

## Contributing

Contributions are welcome! Please see [DOCUMENTATION.md](./DOCUMENTATION.md) for detailed development information.

## License

MIT License

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol specification
- [Mock Service Worker](https://mswjs.io/) - API mocking library
