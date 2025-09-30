# MSW MCP Server

A Model Context Protocol (MCP) server that enables AI-driven control of Mock Service Worker (MSW) in browser environments. This server acts as a bridge between AI assistants and MSW service workers, allowing dynamic API mocking through intelligent handler generation and real-time updates.

## 🎯 Overview

The MSW MCP Server provides AI assistants with the ability to:

- **Generate MSW handlers** on-demand based on natural language descriptions
- **Dynamically update** browser service worker handlers in real-time
- **Manage API mocking** state and configuration remotely
- **Control MSW lifecycle** (start, stop, reset handlers)

## 🏗️ Architecture

```
┌─────────────────┐    MCP Protocol    ┌─────────────────────┐    WebSocket    ┌──────────────────┐
│                 │◄──────────────────►│                     │◄───────────────►│                  │
│   AI Assistant  │                    │   MSW MCP Server    │                 │  Browser MSW     │
│   (Claude etc.) │                    │                     │                 │  Service Worker  │
│                 │                    │                     │                 │                  │
└─────────────────┘                    └─────────────────────┘                 └──────────────────┘
```

### Components

1. **AI Assistant** - Generates JavaScript handler code and calls MCP tools
2. **MSW MCP Server** - Relays commands between AI and browser via WebSocket
3. **Browser Service Worker** - Executes MSW handler updates in real-time

## 🛠️ MCP Tools

The server exposes four main tools for AI interaction:

### `msw_add_handlers`

Add new MSW request handlers to the browser service worker at runtime.

**Input:**

```json
{
  "handlers": [
    "http.get('/users', () => HttpResponse.json([{id:1,name:'John'}]))",
    "http.post('/users', async ({request}) => { const user = await request.json(); return HttpResponse.json({...user, id: Date.now()}) })"
  ]
}
```

### `msw_reset_handlers`

Reset MSW handlers. Optionally provide new handlers to replace all existing ones.

**Input:**

```json
{
  "handlers": ["..."] // Optional: new handlers to set
}
```

### `msw_remove_handlers`

Remove specific handlers by URL patterns.

**Input:**

```json
{
  "patterns": ["/users", "/api/v1/*", "https://api.example.com/*"]
}
```

### `msw_get_status`

Get current status of the MSW service worker and active handlers.

**Output:**

```json
{
  "connected": true,
  "workerStatus": "running",
  "activeHandlers": ["http.get('/users', ...)", "..."],
  "handlerCount": 5
}
```

## 🚀 Usage

### Installation & Setup

1. **Clone and build:**

```bash
git clone <repository>
cd msw-mcp
npm install
npm run build
```

2. **Run the server:**

```bash
# Default port 6789
npm run start

# Custom WebSocket port
node build/index.js --mock-ws-port 3001
node build/index.js --mock-ws-port=8080
```

### Claude Desktop Integration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "msw-mcp-server": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/msw-mcp/build/index.js",
        "--mock-ws-port=6789"
      ]
    }
  }
}
```

### Frontend Integration

The MSW MCP Server integrates with your existing frontend MSW setup through a WebSocket bridge module.

#### Integration Files

Create the following files in your frontend project:

**1. `mocks/websocket-bridge.js`** - WebSocket client that connects to MCP server

**2. Update `mocks/index.js`** to initialize the bridge:

```javascript
export async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const { worker } = await import('./browser');

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false,
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });

  // Initialize WebSocket bridge for AI-driven handler updates
  try {
    const { createMSWBridge } = await import('./websocket-bridge');
    const bridge = createMSWBridge(worker);

    if (bridge) {
      console.log('[MSW] WebSocket bridge initialized for AI integration');
      if (typeof window !== 'undefined') {
        window.__mswBridge = bridge;
      }
    }
  } catch (error) {
    console.warn('[MSW] Failed to initialize WebSocket bridge:', error);
  }

  return worker;
}
```

#### Configuration

Set the MCP server URL via environment variable (optional):

```bash
# Default: ws://localhost:6789
export MCP_SERVER_URL=ws://localhost:3001
```

#### Features

- ✅ **Development-only mode** - Bridge only activates in `NODE_ENV=development`
- ✅ **Dynamic handler management** - Add/remove/reset handlers in real-time
- ✅ **Automatic reconnection** - Reconnects if connection drops
- ✅ **Safe execution context** - Handler code executes with controlled scope
- ✅ **Debugging support** - Access bridge via `window.__mswBridge` in console

#### Enabling/Disabling Connection

To disable the WebSocket connection temporarily, edit `mocks/websocket-bridge.js`:

```javascript
connect() {
  // WebSocket connection disabled for now
  console.log(`[MSW Bridge] WebSocket connection disabled`)
  return

  // ... rest of connection code
}
```

To re-enable, simply remove the early return statement.

#### Example Workflow

1. **Start MCP Server:**

   ```bash
   cd msw-mcp
   npm run build && npm run start
   ```

2. **Start Frontend Dev Server:**

   ```bash
   cd your-frontend-project
   npm run dev
   ```

3. **Use AI Tools via Claude Desktop:**
   - AI generates handler code
   - MCP server sends handlers via WebSocket
   - Browser updates handlers in real-time
   - No page reload required

## 💬 AI Usage Examples

### Generate a REST API

```
AI: "Create a REST API for user management with GET /users, POST /users, and GET /users/:id"

MSW MCP Server: Generates and applies handlers:
- http.get('/users', () => HttpResponse.json([...]))
- http.post('/users', async ({request}) => {...})
- http.get('/users/:id', ({params}) => {...})
```

### Update Existing Endpoints

```
AI: "Make the users API return 500 errors for testing"

MSW MCP Server: Updates handlers to return error responses
```

### Mock External APIs

```
AI: "Mock the GitHub API to return fake repository data"

MSW MCP Server: Creates handlers for github.com API endpoints
```

## 📡 WebSocket Protocol

### Message Format

**Client → Server:**

```json
{
  "id": "uuid",
  "type": "ADD_HANDLERS" | "RESET_HANDLERS" | "REMOVE_HANDLERS" | "GET_STATUS",
  "handlers": ["handler1", "handler2"], // Optional
  "patterns": ["/pattern1", "/pattern2"] // Optional for REMOVE_HANDLERS
}
```

**Server → Client:**

```json
{
  "id": "uuid",
  "type": "SUCCESS" | "ERROR" | "STATUS_RESPONSE",
  "activeHandlers": ["..."], // Current handler list
  "workerStatus": "running" | "stopped" | "unknown",
  "error": "Error message" // Only for ERROR type
}
```

## 📁 Project Structure

### MCP Server

```
msw-mcp/
├── src/
│   ├── index.ts                  # Main MCP server entry point
│   ├── tools/                    # MCP tool implementations
│   │   ├── msw-add-handlers.ts
│   │   ├── msw-reset-handlers.ts
│   │   ├── msw-remove-handlers.ts
│   │   └── msw-get-status.ts
│   └── websocket/                # WebSocket server & connection management
│       ├── server.ts             # WebSocket server
│       ├── connection-manager.ts # Client connection handling
│       └── protocol.ts           # Message type definitions
├── package.json
└── tsconfig.json
```

### Frontend Integration

```
your-frontend-project/
├── mocks/
│   ├── websocket-bridge.js      # WebSocket client bridge (NEW)
│   ├── index.js                 # MSW initialization (MODIFIED)
│   ├── browser.js               # MSW worker setup
│   ├── handlers.js              # Base handlers
│   └── custom-handlers/         # Local-only handlers (gitignored)
├── mockServiceWorker.js         # MSW service worker
└── src/
    └── main.js                  # App entry point
```

## 🔧 Development

### Scripts

```bash
npm run build     # Build TypeScript
npm run watch     # Watch mode compilation
npm run dev       # Build and run
npm run start     # Run built server
npm run format    # Format code with Prettier
```

### Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js --mock-ws-port=3001

# Test WebSocket connection manually
node build/index.js --mock-ws-port=8080
# Connect WebSocket client to ws://localhost:8080
```

## ⚙️ Configuration

### MCP Server Options

**Command Line Arguments:**

- `--mock-ws-port <port>` - Set WebSocket server port (default: 6789)
- `--mock-ws-port=<port>` - Alternative syntax with equals sign

**Example:**

```bash
node build/index.js --mock-ws-port=3001
```

### Frontend Bridge Options

**Environment Variables:**

- `MCP_SERVER_URL` - WebSocket server URL (default: `ws://localhost:6789`)
- `NODE_ENV` - Must be `development` for bridge to activate

**Constructor Options:**

```javascript
const bridge = createMSWBridge(worker, {
  url: 'ws://localhost:3001', // MCP server URL
  reconnectInterval: 5000, // Time between reconnect attempts (ms)
  maxReconnectAttempts: 10, // Max reconnection attempts
});
```

**Debugging:**

Access bridge instance in browser console:

```javascript
window.__mswBridge; // Bridge instance (dev only)
window.__mswBridge.ws; // WebSocket connection
window.__mswBridge.activeHandlers; // Currently active handlers
```

## 🔮 Roadmap

### Phase 1: ✅ Complete

- [x] MCP server with MSW tools
- [x] WebSocket server for browser communication
- [x] Command line port configuration
- [x] Claude Desktop integration

### Phase 2: ✅ Complete

- [x] Browser WebSocket bridge implementation
- [x] WebSocket client connection to MCP server
- [x] Real-time handler updates in browser
- [x] Dynamic handler management (add/remove/reset)
- [x] Integration with existing MSW setups
- [x] Development-only execution mode
- [x] Automatic reconnection logic

### Phase 3: Future

- [ ] OpenAPI spec integration
- [ ] Smart mock data generation
- [ ] Handler persistence and export
- [ ] Multiple browser session support
- [ ] Visual handler management UI

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol specification
- [Mock Service Worker](https://mswjs.io/) - API mocking library
- [Claude Desktop](https://claude.ai/download) - AI assistant with MCP support
