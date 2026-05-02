# Project Instructions

This file provides instructions for AI agents working on this project.

@./AGENTS.md

## Development Guidelines

- **Workspaces:** Always perform actions from the root using `pnpm` and `turbo`.
- **Dependencies:** Add shared devDependencies to the root `package.json`. Package-specific dependencies go into the package's `package.json`.
- **Code Style:** Follow the Prettier configuration. Use `pnpm run format` before committing.
- **Builds:** Use `pnpm run build` to ensure all packages compile correctly.
- **TypeScript:** The project uses TypeScript. Ensure types are correct and avoid `any` or `@ts-ignore` unless absolutely necessary.
