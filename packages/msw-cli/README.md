# msw-cli

A command-line interface for AI agents to dynamically update Mock Service Worker (MSW) handlers.

This CLI allows you (or an AI agent) to interact with a running MSW daemon, enabling the dynamic addition, modification, and removal of mock endpoints without restarting your application.

## Installation

```bash
npm install -g msw-cli
```

## Workflow

**New project?** Run `msw-cli setup` first — it prints the full scaffolding guide for MSW + `@msw-mcp/client`.

Like `playwright-cli`, you must **open a session** before using handler commands:

```bash
# 1. Start the daemon (prints WebSocket URL and port)
msw-cli open

# 2. Add handlers
msw-cli add "http.get('/api/user', () => HttpResponse.json({ id: 1 }))"

# 3. Check browser connection
msw-cli status

# 4. Close when done
msw-cli close
```

If your app already configures a fixed WebSocket port, pass it explicitly:

```bash
msw-cli open --port 6789
```

When the default port (6789) is busy, `open` without `--port` auto-selects the next available port and tells you to update the app's MSW bridge URL.

## Commands

### `setup`

Print MSW project setup instructions for AI agents (no daemon required).

```bash
$ msw-cli setup
$ msw-cli setup --framework vite
```

### `open`

Start (or reuse) an MSW daemon session. Required before `add`, `update`, `remove`, `reset`, and `status`.

```bash
$ msw-cli open
$ msw-cli open --port 6789
$ msw-cli open -s my-app --port 6789
$ msw-cli open --no-persist-handlers
$ msw-cli open --persist-handlers 10
$ msw-cli open --single-client
```

| Flag                     | Description                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `-s, --session`          | Session name (default: current directory name)                                                           |
| `--port`                 | Bind to this port; fails if in use (no auto-increment)                                                   |
| `--persist-handlers [N]` | Persist handlers across page refreshes — **enabled by default**; pass `N` to cap at N most recent (FIFO) |
| `--no-persist-handlers`  | Disable handler persistence                                                                              |
| `--single-client`        | Only broadcast to the most recently connected tab (default: broadcast to all)                            |

### `add <handlers...>`

Add new MSW handlers. Requires an open session.

```bash
$ msw-cli open
$ msw-cli add "http.get('/api/user', () => HttpResponse.json({ id: 1 }))"
```

### `update <patterns...>`

Update existing MSW handlers that match specified URL string patterns.

```bash
$ msw-cli update "/api/user" -h "http.get('/api/user', () => HttpResponse.json({ id: 2 }))"
```

### `remove <patterns...>`

Remove MSW handlers matching specified URL patterns.

```bash
$ msw-cli remove "/api/user"
```

### `reset [handlers...]`

Reset MSW handlers. If no handlers are provided, it removes all runtime handlers and keeps only the initial ones.

```bash
$ msw-cli reset
```

### `status`

Get the status of the open MSW session (browser connection, active handlers).

```bash
$ msw-cli status
```

### Session Management

Session metadata is stored under `~/.msw-cli/sessions/`.

By default, `msw-cli` isolates environments based on the current working directory. Use `-s, --session <name>` on the root command to target a specific session across `open` and handler commands.

- **`list`**: List all active sessions and their ports.
- **`close [session]`**: Close a specific session.
- **`close-all`**: Close all active sessions.

## Session not open

If you run `add`, `update`, `remove`, `reset`, or `status` without `open`, the CLI exits with instructions to run `msw-cli open` first.
