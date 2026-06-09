---
name: msw-cli
description: >-
  Control MSW mocks at runtime via msw-cli (open session, add/update/remove handlers).
  Use when mocking APIs, changing mock responses, or debugging MSW without restarting the app.
---

# msw-cli

Dynamically add, update, and remove MSW handlers while the app keeps running. Run commands from the project directory (or pass `-s <name>` for a named session).

Project not set up yet? Use the **msw-setup** skill or run **`msw-cli setup`** first.

## Quick start

```bash
msw-cli open                    # prints WebSocket URL + port
# If port ≠ app config, update MSW_WS_URL (or VITE_MSW_WS_URL / NEXT_PUBLIC_MSW_WS_URL) to match output
msw-cli add "http.get('/api/users', () => HttpResponse.json([{ id: 1 }]))"
msw-cli status                  # connected must be true for mocks to apply
msw-cli close
```

Use `msw-cli open --port 6789` when the app already hard-codes that port. Handler commands (`add`, `update`, `remove`, `reset`, `status`) **require** `open` first — otherwise you get "Session not open".

## Workflow

1. `open` — start daemon; read **Port** and **WebSocket** from markdown output.
2. Sync app — if port auto-changed (6789 busy), set `ws://127.0.0.1:<port>` in `MSW_WS_URL` / `VITE_MSW_WS_URL` / `NEXT_PUBLIC_MSW_WS_URL` env.
3. `add` / `update` / `remove` / `reset` — handler changes.
4. `status` — confirm browser connected.
5. `close` when finished.

Sessions: default name = current directory basename. State: `~/.msw-cli/sessions/`.

## Handler rules

- Valid JS strings; `http`, `graphql`, `HttpResponse` are in scope (no imports).
- Wrap handlers in double quotes; use single quotes inside JS.
- Return a `Response` via `HttpResponse` (e.g. `HttpResponse.json({ ok: true })`).

## Commands

| Command                                                                                      | Purpose                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `open [--port N] [-s name] [--no-persist-handlers] [--persist-handlers N] [--single-client]` | Start/reuse daemon (required first)       |
| `add "<handler>"`                                                                            | Add handler(s)                            |
| `update "<pattern>" -h "<handler>"`                                                          | Replace handlers matching pattern         |
| `remove "<pattern>"`                                                                         | Remove handlers                           |
| `reset [handlers...]`                                                                        | Clear runtime handlers (optional new set) |
| `status`                                                                                     | Connection + active handlers              |
| `list`                                                                                       | All open sessions                         |
| `close [name]` / `close-all`                                                                 | Stop daemon(s)                            |

## Troubleshooting

- **Session not open** → run `msw-cli open`, then retry.
- **No browser clients connected** → app not wired to the WebSocket URL from `open`; fix port/env and reload.
- **Mock not firing** → match request path exactly or use wildcards (`*/api/users/*`).
- **`open --port` fails** → port in use; free it or use `open` without `--port` and sync app to the new port.
- **Handler syntax errors** → check shell quoting and JS validity.
