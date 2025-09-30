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

### Browser Integration (Phase 2)

_Coming soon: Browser service worker that connects to the WebSocket server_

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

```
src/
├── index.ts                 # Main MCP server entry point
├── tools/                   # MCP tool implementations
│   ├── msw-add-handlers.ts
│   ├── msw-reset-handlers.ts
│   ├── msw-remove-handlers.ts
│   └── msw-get-status.ts
├── websocket/               # WebSocket server & connection management
│   ├── server.ts           # WebSocket server
│   ├── connection-manager.ts # Client connection handling
│   └── protocol.ts         # Message type definitions
└── utils/                   # Utilities (future)
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

## 🌐 Command Line Options

- `--mock-ws-port <port>` - Set WebSocket server port (default: 6789)
- `--mock-ws-port=<port>` - Alternative syntax with equals sign

## 🔮 Roadmap

### Phase 1: ✅ Complete

- [x] MCP server with MSW tools
- [x] WebSocket server for browser communication
- [x] Command line port configuration
- [x] Claude Desktop integration

### Phase 2: In Progress

- [ ] Browser service worker implementation
- [ ] WebSocket client connection to MCP server
- [ ] Real-time handler updates in browser
- [ ] MSW worker lifecycle management

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
