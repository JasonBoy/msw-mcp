# @msw-mcp/core

WebSocket daemon and session management for the MSW AI bridge. Brokers HTTP tool calls from `msw-cli` (or the MCP server) to browser clients connected over WebSocket.

## What it provides

- **`WSServer`** — HTTP + WebSocket server for handler commands and status
- **`SessionManager`** — Tracks open sessions under `~/.msw-cli/sessions/`
- **`loadMswSetupPrompt`** — Loads `prompts/msw-setup.md` for `msw-cli setup` and MCP `/msw-setup`
- **`ConnectionManager`** — Routes messages to connected MSW browser clients
- **`daemon.js`** — Standalone process spawned by `msw-cli open`

## Used by

- [`msw-cli`](../msw-cli) — spawns the daemon and sends handler updates
- [`msw-mcp`](../msw-mcp) — in-process MCP server using the same server logic

## Development

From the monorepo root:

```bash
pnpm --filter @msw-mcp/core run build
```

## License

MIT
