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
- `pnpm run test`: Run all package tests via Turbo.
- `pnpm run test:coverage`: Run tests with v8 coverage reporting.
- `pnpm run format`: Format the entire codebase.
- `pnpm turbo run <task>`: Run specific Turbo tasks.

## Testing

The repo uses **[Vitest](https://vitest.dev)** (v4.x). Test dependencies live in the root `package.json`; each package has its own `vitest.config.ts` and `"test"` script.

### When to add tests

Add or update tests whenever you change behavior — new features, bug fixes, refactors, or CLI/MCP tool output. Skip tests only for docs-only or purely cosmetic changes.

### Conventions

- **Location:** Co-locate tests as `src/**/*.test.ts` next to the code they cover.
- **Build:** Test files are excluded from `tsc` output via each package's `tsconfig.json` `exclude`.
- **Environment:** Node for `core`, `msw-cli`, and `msw-mcp`; `jsdom` for `@msw-mcp/client` (browser APIs).
- **Style:** Prefer unit tests with injected/mocked dependencies. Use integration tests sparingly for real WebSocket/HTTP round-trips (see `packages/core/src/server.integration.test.ts`).
- **Scope:** Test real behavior and edge cases — not trivial getters or framework wiring. Mock `console.error` when exercising expected error paths to keep output clean.

### Package-specific notes

| Package           | What to test                                                                        | Mocking tips                                                                |
| ----------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `@msw-mcp/core`   | `SessionManager`, `ConnectionManager`, `loadMswSetupPrompt`, `WSServer` integration | Fake WebSocket clients, `vi.spyOn(os, 'homedir')`, fake timers for timeouts |
| `@msw-mcp/client` | `MSWWebSocketBridge` message routing, pattern matching, persistence                 | Mock `window.msw`, fake MSW worker (`use`/`resetHandlers`)                  |
| `msw-cli`         | Pure helpers in `src/helpers.ts`                                                    | Import helpers directly — do not import `index.ts` (triggers CLI parse)     |
| `msw-mcp`         | Tool factories in `src/tools/`                                                      | Inject a fake `wsServer` with stubbed `sendMessage`                         |

### Running tests

```bash
pnpm run test                              # all packages
pnpm --filter @msw-mcp/core exec vitest run  # single package
pnpm --filter @msw-mcp/core exec vitest run --coverage
```

CI runs `pnpm run build` then `pnpm run test` (see `.github/workflows/ci.yml`).

## Development Guidelines

- **Workspaces:** Always perform actions from the root using `pnpm` and `turbo`.
- **Dependencies:** Add shared devDependencies to the root `package.json`. Package-specific dependencies go into the package's `package.json`.
- **Code Style:** Follow the Prettier configuration. Use `pnpm run format` before committing.
- **Builds:** Use `pnpm run build` to ensure all packages compile correctly.
- **TypeScript:** The project uses TypeScript. Ensure types are correct and avoid `any` or `@ts-ignore` unless absolutely necessary.
