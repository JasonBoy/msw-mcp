# MSW AI Agent Bridge Monorepo

This monorepo provides a suite of tools that bridge AI agents with Mock Service Worker (MSW). It enables dynamic addition, updating, and removal of MSW network mocks directly from a command-line interface or AI tool execution, completely independently of the application source code restarts.

## Demo

Walkthrough of the MCP-driven MSW workflow (browser bridge, live handler updates):

https://github.com/user-attachments/assets/06959759-b198-4cd1-ae2b-11ede32acd8e

## Key features

- 🤖 **Generate MSW handlers with AI**
- ⚡ **Update mocks without reloading the page**
- 🌉 **WebSocket bridge between Cli/MCP and the browser**
- 🛠️ **Scaffold MSW setup with `msw-cli setup` or MCP's `/msw-setup` prompt**
- 💻 **Terminal and script control via `msw-cli`**
- ⚙️ **Configurable port, persistence, and client targeting**
- ✨ **Agent skills for AI agents to use**

## Structure

This project is set up as a monorepo using `pnpm` and `turbo`.

- **`apps/docs`** (`@msw-mcp/docs`): Starlight documentation site for MSW Agent Tools (CLI, MCP, guides). Source lives under `apps/docs/src/content/docs/`.
- **`packages/msw-cli`**: The command-line interface (`msw-cli`) used by AI agents or developers to send dynamic handler updates. Run `msw-cli setup` to scaffold a project, then `msw-cli open` plus handler commands.
- **`packages/msw-mcp`**: The published Model Context Protocol server (`msw-mcp`) so assistants can manage mocks via MCP tools.
- **`packages/client`** (`@msw-mcp/client`): The browser/environment client that listens for updates and registers them with the local MSW setup.
- **`packages/core`** (`@msw-mcp/core`): The core daemon process and session management logic that brokers communication between the CLI or MCP server and the client.

## Documentation site

From the repo root:

```bash
pnpm --filter @msw-mcp/docs dev
```

Opens the local docs dev server (default Astro port, often `http://localhost:4321`). Production search (Pagefind) is easiest to verify after `pnpm --filter @msw-mcp/docs build` and `pnpm --filter @msw-mcp/docs preview`.

More detail: [apps/docs/README.md](apps/docs/README.md).

## Quick setup: msw-cli

1. Install the CLI globally: `npm install -g msw-cli` (or use your package manager’s equivalent).
2. In a new project, run **`msw-cli setup`** and follow the printed steps for MSW + `@msw-mcp/client`.
3. Start a session, then drive handlers from the shell:

   ```bash
   msw-cli open
   msw-cli add "http.get('/api/user', () => HttpResponse.json({ id: 1 }))"
   msw-cli status
   msw-cli close
   ```

Full command reference, flags, and workflows: [packages/msw-cli/README.md](packages/msw-cli/README.md).

## Quick setup: msw-mcp (MCP)

1. Register the server in your MCP client (example for JSON config):

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

2. In the client, use the **`/msw-setup`** prompt (or follow manual steps) so the browser app loads `msw`, `@msw-mcp/client`, and the worker bridge.

Installation options (VS Code, Claude Code, Cursor, etc.), architecture, MCP tools, and manual setup: [packages/msw-mcp/README.md](packages/msw-mcp/README.md).

## Development Scripts

Run these scripts from the root directory using `pnpm`:

- **`pnpm build`**: Compiles all packages using Turborepo.
- **`pnpm dev`**: Starts the development pipelines for all packages.
- **`pnpm format`**: Formats the code using Prettier.
- **`pnpm lint`**: Runs linting checks across the repository.

## Getting Started

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Build the project:**

   ```bash
   pnpm build
   ```

3. **Use the CLI:**  
   You can navigate to the CLI directory or use it directly via node after building:

   ```bash
   node packages/msw-cli/build/index.js help
   ```

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).
