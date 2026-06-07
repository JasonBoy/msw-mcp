---
name: msw-setup
description: >-
  Scaffold MSW and @msw-mcp/client in a web project for AI-driven dynamic mocks.
  Use when the user asks to set up MSW, add mocking to a new app, or migrate an existing MSW project.
---

# msw-setup

Project scaffolding for MSW + the MCP client bridge. For **runtime** handler changes after setup, use the `msw-cli` skill.

## Workflow

1. Run **`msw-cli setup`** in the project root (optional: `--framework vite`).
2. Follow the printed setup guide step by step (detect bundler, install deps, create `mocks/`, env vars, entry point).
3. Run **`msw-cli open`** and set the app's WebSocket URL to the URL from the output.
4. Run **`msw-cli status`** after starting the dev server — confirm `connected: true`.
5. Use **`msw-cli add`** (and related commands) to manage mocks at runtime.

Do not duplicate the full setup guide in chat — execute from `msw-cli setup` output.

## Notes

- Ask permission before `npm install` / `npx msw init` (as the guide describes).
- The WebSocket URL env var name depends on the framework: `NEXT_PUBLIC_MSW_WS_URL` (Next.js), `VITE_MSW_WS_URL` (Vite), or `MSW_WS_URL` (Rspack/Rsbuild/Webpack) — must match the port from `msw-cli open`. (`MCP_SERVER_URL` is accepted as a legacy fallback.)
- MCP users can still use `/msw-setup` in an MCP client; the same guide backs both paths.
