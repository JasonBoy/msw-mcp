# @msw-mcp/client

Browser-side bridge that connects your MSW service worker to the `@msw-mcp/core` daemon. Receives dynamic handler updates over WebSocket and applies them at runtime.

## Install

```bash
npm install -D @msw-mcp/client msw
```

## Usage

Expose MSW on `window` (required for dynamic handler evaluation), then connect the bridge:

```ts
import { initMocking } from '@msw-mcp/client';

await initMocking(worker, {
  url: import.meta.env.VITE_MCP_SERVER_URL ?? 'ws://localhost:6789',
});
```

The WebSocket URL must match the port from `msw-cli open`. See [`msw-cli`](../msw-cli) for the open-first workflow.

## API

- **`initMocking(worker, options?)`** — Connect bridge to the daemon (recommended)
- **`createMSWBridge(worker, options?)`** — Lower-level bridge constructor
- **`MSWBridgeOptions`** — `url`, `reconnectInterval`, `maxReconnectAttempts`, `enabled`

## Development

From the monorepo root:

```bash
pnpm --filter @msw-mcp/client run build
```

## License

MIT
