# MSW MCP Server

A Model Context Protocol (MCP) server that enables AI-driven control of Mock Service Worker (MSW) in browser environments. This server acts as a bridge between AI assistants and MSW service workers, allowing dynamic API mocking through intelligent handler generation and real-time updates.

**Includes:**

- 🖥️ **MCP Server** - WebSocket server for AI ↔ Browser communication
- 📦 **Client Package** (`msw-mcp/client`) - Importable browser-side integration
- 🤖 **`/msw-setup` Prompt** - Automated project scaffolding

## 🎯 Overview

The MSW MCP Server provides AI assistants with the ability to:

- **Generate MSW handlers** on-demand based on natural language descriptions
- **Dynamically update** browser service worker handlers in real-time
- **Manage API mocking** state and configuration remotely
- **Control MSW lifecycle** (start, stop, reset handlers)
- **Automated setup** via `/msw-setup` prompt for any web project

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

## 🛠️ MCP Tools & Prompts

### Prompts

#### `/msw-setup`

Automated setup prompt that scaffolds MSW configuration in your web application.

**Features:**

- 🔍 Auto-detects framework (React, Vue, Svelte, vanilla)
- 📦 Installs dependencies (`msw` and `msw-mcp`)
- 📁 Creates complete mocks directory structure
- ⚙️ Configures environment variables
- 🔗 Integrates with app entry point
- 🔄 Handles migration for existing MSW setups

**Usage:**

```
/msw-setup
```

**Optional arguments:**

- `framework` - Specify framework type (auto-detects if omitted)
- `serviceWorkerPath` - Custom service worker URL (default: `/mockServiceWorker.js`)

### Tools

The server exposes five main tools for AI interaction:

### `msw_add_handlers`

Add new MSW request handlers to the browser service worker at runtime.

**Available MSW Utilities:**

- `http` - HTTP method handlers (get, post, put, delete, etc.)
- `HttpResponse` - Response constructors (json, text, xml, etc.)
- `bypass` - Bypass handler and perform original request
- `passthrough` - Explicitly passthrough to network
- `delay` - Add response delay for testing

**Input:**

```json
{
  "handlers": [
    "http.get('/users', () => HttpResponse.json([{id:1,name:'John'}]))",
    "http.post('/users', async ({request}) => { const user = await request.json(); return HttpResponse.json({...user, id: Date.now()}) })"
  ],
  "once": false
}
```

**Parameters:**

- `handlers` (required): Array of handler code strings
- `once` (optional, default: `false`): If `true`, handlers will only intercept the first matching request and then be automatically deactivated

**Example with `bypass`:**

```json
{
  "handlers": [
    "http.get('https://api.example.com/data', async ({ request }) => { const url = new URL(request.url); if (url.searchParams.get('mock') === 'true') { const response = await fetch(bypass(request)); const data = await response.json(); return HttpResponse.json({ ...data, mocked: true }); } return passthrough(); })"
  ]
}
```

**Example with `once` (one-time handler):**

```json
{
  "handlers": [
    "http.get('/one-time-resource', () => HttpResponse.json({ special: true }))"
  ],
  "once": true
}
```

After the first request to `/one-time-resource`, the handler will be automatically deactivated and subsequent requests will pass through to the real API.

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

### `msw_update_handlers`

Update existing handlers by replacing handlers that match specified URL patterns with new handler code. This is an atomic operation.

**Input:**

```json
{
  "patterns": ["/users", "/api/v1/products"],
  "handlers": [
    "http.get('/users', () => HttpResponse.json([{id:1,name:'Updated User'}]))",
    "http.get('/api/v1/products', () => HttpResponse.json([{id:1,name:'New Product'}]))"
  ]
}
```

**Example use case:**

```
AI: "Update the /users endpoint to return users with an 'updated' flag"
→ Uses msw_update_handlers to atomically replace the handler
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
        // Optional: Add "--single-client" for single-client mode
        // Optional: Add "--persist-handlers" or "--persist-handlers=10" for persistence
      ]
    }
  }
}
```

### Quick Setup with `/msw-setup` Prompt

The easiest way to set up MSW with AI-driven handler support is using the `/msw-setup` prompt (available in Claude Desktop or other MCP clients):

```
/msw-setup
```

The AI will automatically:

- ✅ Detect your framework (React, Vue, Svelte, etc.)
- ✅ Install dependencies (`msw` and `msw-mcp`)
- ✅ Create complete mocks directory structure
- ✅ Configure environment variables
- ✅ Integrate with your app entry point
- ✅ Handle migration if MSW is already set up

For existing MSW setups, it will migrate to use `msw-mcp/client` while preserving your existing handlers.

### Manual Frontend Integration

If you prefer manual setup, install the client package:

```bash
npm install -D msw-mcp
```

#### New Project Setup

**1. Install MSW and initialize service worker:**

```bash
npm install -D msw@^2.11.0
npx msw init public/ --save
```

**2. Create mocks structure:**

**`mocks/handlers.js`** - Your API handlers:

```javascript
import { http, HttpResponse } from 'msw';

// Base handlers - committed to git
const baseHandlers = [
  // Add your handlers here
];

// Import custom handlers (local only, gitignored)
let customHandlers = [];
try {
  const customModule = await import('./custom-handlers/index.js');
  customHandlers = customModule.handlers || [];
} catch (error) {
  console.log('[MSW] No custom handlers found');
}

export const handlers = [...baseHandlers, ...customHandlers];
```

**`mocks/browser.js`** - MSW worker setup:

```javascript
import { setupWorker } from 'msw/browser';
import * as msw from 'msw';
import { handlers } from './handlers';

// Expose MSW on window for msw-mcp client bridge
if (typeof window !== 'undefined') {
  window.msw = msw;
}

export const worker = setupWorker(...handlers);
```

**`mocks/index.js`** - Initialization with WebSocket bridge:

```javascript
import { enableMocking as enableMockingFromClient } from 'msw-mcp/client';
import { worker } from './browser';

export async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const isMSWEnabled =
    process.env.ENABLE_MSW_MOCK === '1' ||
    process.env.ENABLE_MSW_MOCK === 'true';

  if (!isMSWEnabled) {
    console.log('[MSW] Mocking disabled');
    return;
  }

  const isWSEnabled =
    process.env.ENABLE_MSW_WS_MOCK === '1' ||
    process.env.ENABLE_MSW_WS_MOCK === 'true';

  return enableMockingFromClient({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789',
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    },
  });
}
```

**3. Add .gitignore entry:**

```gitignore
# MSW local-only custom handlers
mocks/custom-handlers/
!mocks/custom-handlers/index.example.js
```

**4. Environment configuration:**

Create `.env.local`:

```bash
ENABLE_MSW_MOCK=true
ENABLE_MSW_WS_MOCK=true
MCP_SERVER_URL=ws://localhost:6789
```

**5. Integrate with your app:**

```javascript
// src/main.js (or your app entry point)
import { enableMocking } from '../mocks';

async function startApp() {
  await enableMocking();

  // ... rest of your app initialization
}

startApp();
```

#### Client API Reference

**`enableMocking(options)`**

Main setup function that starts MSW worker and initializes WebSocket bridge.

```typescript
interface EnableMockingOptions {
  worker: any; // MSW worker instance (required)
  wsEnabled?: boolean; // Enable WebSocket bridge (default: true)
  wsBridgeOptions?: {
    url?: string; // WebSocket URL (default: ws://localhost:6789)
    reconnectInterval?: number; // Reconnect delay in ms (default: 5000)
    maxReconnectAttempts?: number; // Max reconnect attempts (default: 10)
    enabled?: boolean; // Enable/disable bridge (default: true)
  };
  workerOptions?: {
    onUnhandledRequest?: 'warn' | 'error' | 'bypass';
    quiet?: boolean;
    serviceWorker?: { url: string };
  };
}
```

**`createMSWBridge(worker, options?)`**

Lower-level API to create just the WebSocket bridge without starting the worker.

```typescript
interface MSWBridgeOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
}
```

#### Features

- ✅ **Development-only mode** - Bridge only activates in `NODE_ENV=development`
- ✅ **Dynamic handler management** - Add/remove/reset handlers in real-time
- ✅ **Handler persistence** - Automatically restore handlers after page refresh (when enabled on server)
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
  "type": "ADD_HANDLERS" | "RESET_HANDLERS" | "REMOVE_HANDLERS" | "UPDATE_HANDLERS" | "GET_STATUS",
  "handlers": ["handler1", "handler2"], // Optional
  "patterns": ["/pattern1", "/pattern2"], // Optional for REMOVE_HANDLERS and UPDATE_HANDLERS
  "once": true // Optional for ADD_HANDLERS (one-time handlers)
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
│   │   ├── msw-update-handlers.ts
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
- `--single-client` - Enable single-client mode (send messages only to the most recently connected tab). Default: broadcast to all connected tabs
- `--persist-handlers` - Persist dynamically added handlers to localStorage across page refreshes (unlimited)
- `--persist-handlers=<N>` - Persist only the N most recent handlers (FIFO)

**Example:**

```bash
# Default: broadcast to all tabs, no persistence
node build/index.js --mock-ws-port=3001

# Single-client mode: only the latest tab receives messages
node build/index.js --mock-ws-port=3001 --single-client

# Persist all handlers across page refreshes
node build/index.js --persist-handlers

# Persist only the 10 most recent handlers
node build/index.js --persist-handlers=10
```

**Broadcast vs Single-Client Mode:**

- **Broadcast mode (default)**: Messages are sent to all connected browser tabs. All tabs stay in sync with handler state.
- **Single-client mode**: Messages are sent only to the most recently connected tab. Useful when working with a single active tab to avoid confusion with multiple tabs open.

**Handler Persistence:**

When `--persist-handlers` is enabled, dynamically added handlers are saved to the browser's localStorage and automatically restored on page refresh. This prevents the need to re-add handlers after every reload.

- **Storage key**: `msw_dynamic_handlers`
- **FIFO behavior**: When a limit is set (e.g., `--persist-handlers=10`), only the N most recently added handlers are kept
- **Development-only**: Persistence only works when `process.env.NODE_ENV === 'development'`
- **Manual cleanup**: Clear persisted handlers from browser console:
  ```javascript
  window.__mswBridge.clearPersistedHandlers();
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
- [x] Dynamic handler management (add/remove/reset/update)
- [x] One-time handler support with `once` option
- [x] MSW utilities support (bypass, passthrough, delay)
- [x] Handler status summaries (method + URL only)
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
