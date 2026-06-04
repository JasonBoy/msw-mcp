# Monorepo Overview

This project is a monorepo managed by **pnpm** and **Turborepo**. It is designed to house multiple packages related to MSW (Mock Service Worker) and MCP (Model Context Protocol).

## Tooling

- **Package Manager:** [pnpm](https://pnpm.io/) (Workspaces)
- **Build System:** [Turborepo](https://turborepo.dev/docs)
- **Linting & Formatting:** Prettier, lint-staged, Husky
- **Language:** TypeScript

## Structure

- `packages/`: Contains the individual workspace packages.
  - `msw-mcp`: The core MCP server for MSW AI interaction.
- `package.json` (root): Orchestrates the workspace, shared dependencies, and scripts.
- `turbo.json`: Defines the task pipeline and caching strategy.

## Common Commands

- `pnpm install`: Install all dependencies across the workspace.
- `pnpm run build`: Build all packages using Turbo.
- `pnpm run format`: Format the entire codebase.
- `pnpm turbo run <task>`: Run specific Turbo tasks.

## Development Guidelines

- **Workspaces:** Always perform actions from the root using `pnpm` and `turbo`.
- **Dependencies:** Add shared devDependencies to the root `package.json`. Package-specific dependencies go into the package's `package.json`.
- **Code Style:** Follow the Prettier configuration. Use `pnpm run format` before committing.
- **Builds:** Use `pnpm run build` to ensure all packages compile correctly.
- **TypeScript:** The project uses TypeScript. Ensure types are correct and avoid `any` or `@ts-ignore` unless absolutely necessary.
