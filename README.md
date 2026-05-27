# MSW AI Agent Bridge Monorepo

This monorepo provides a suite of tools that bridge AI agents with Mock Service Worker (MSW). It enables dynamic addition, updating, and removal of MSW network mocks directly from a command-line interface or AI tool execution, completely independently of the application source code restarts.

## Structure

This project is set up as a monorepo using `pnpm` and `turbo`.

- **`packages/msw-cli`**: The command-line interface (`msw-cli`) used by AI agents or developers to send dynamic handler updates. Run `msw-cli setup` to scaffold a project, then `msw-cli open` + handler commands.
- **`packages/client`** (`@msw-mcp/client`): The browser/environment client that listens for updates and registers them with the local MSW setup.
- **`packages/core`** (`@msw-mcp/core`): The core daemon process and session management logic that brokers communication between the CLI and the client.

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
