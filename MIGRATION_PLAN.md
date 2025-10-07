# MSW MCP Client Extraction & Setup Prompt - Implementation Plan

## 📋 Overview

Extract web app setup logic from the frontend project into the `msw-mcp` package as an importable module (`msw-mcp/client`), and add an MCP prompt `/msw-setup` for automated integration.

## 🎯 Key Requirements

1. **`/msw-setup` is an MCP Prompt** - Exposed via `server.registerPrompt()` in the MCP server
2. **Support Both Handler Types** - Static handlers (committed) + Custom handlers (local) + WebSocket runtime handlers
3. **Configurable Options** - Replace hardcoded env vars with options API
4. **MSW Version** - Use `^2.11.0` as peer dependency
5. **Two Setup Modes**:
   - **New projects**: Create complete structure from templates
   - **Existing projects**: Migrate to use msw-mcp/client imports

## 🏗️ Architecture Changes

### Current State (Existing Project Example)

```
bili/ad-manager-ultimate-fe/mocks/
├── websocket-bridge.js         (350+ lines - DELETE in migration)
├── index.js                    (enableMocking with env checks - UPDATE)
├── browser.js                  (MSW worker setup - UPDATE)
├── handlers.js                 (base + custom import - KEEP AS-IS)
└── custom-handlers/
    ├── index.js                (gitignored - KEEP AS-IS)
    └── index.example.js        (committed - KEEP AS-IS)
```

### Target State

```
msw-mcp (npm package)
├── build/
│   ├── index.js                (MCP server with /msw-setup prompt)
│   └── client/
│       ├── index.js            (exports)
│       ├── index.d.ts          (TypeScript types)
│       ├── websocket-bridge.js
│       └── enable-mocking.js
└── templates/
    └── mocks/                  (scaffolding templates for new projects)
        ├── handlers.js.template
        ├── browser.js.template
        ├── index.js.template
        └── custom-handlers/
            └── index.example.js.template

User's Web App (New Project - After /msw-setup)
└── mocks/
    ├── handlers.js             (CREATED from template)
    ├── browser.js              (CREATED from template)
    ├── index.js                (CREATED from template)
    └── custom-handlers/
        └── index.example.js    (CREATED from template)

User's Web App (Existing Project - After Migration)
└── mocks/
    ├── handlers.js             (KEPT - no changes)
    ├── browser.js              (UPDATED - import from msw-mcp/client)
    ├── index.js                (UPDATED - use enableMocking from msw-mcp/client)
    └── custom-handlers/
        ├── index.js            (KEPT - no changes)
        └── index.example.js    (KEPT - no changes)
    # websocket-bridge.js DELETED - replaced by import
```

## 📦 Implementation Steps

### Phase 1: Create Client Package (4 tasks)

#### Task 1.1: Create TypeScript Client Code

**File: `src/client/websocket-bridge.ts`**

- Convert current `websocket-bridge.js` to TypeScript
- Replace hardcoded env vars with options API
- Add full type definitions

```typescript
export interface MSWBridgeOptions {
  url?: string; // WebSocket URL (default: ws://localhost:6789)
  reconnectInterval?: number; // Reconnect delay (default: 5000ms)
  maxReconnectAttempts?: number; // Max reconnect attempts (default: 10)
  enabled?: boolean; // Enable/disable bridge (default: true)
}

export class MSWWebSocketBridge {
  constructor(worker: any, options?: MSWBridgeOptions);

  connect(): void;
  disconnect(): void;
  loadPersistedHandlers(): void;
  saveHandlers(): void;
  clearPersistedHandlers(): void;
  // ... other methods
}

export function createMSWBridge(
  worker: any,
  options?: MSWBridgeOptions,
): MSWWebSocketBridge | null;
```

**File: `src/client/enable-mocking.ts`**

- Reusable setup helper that combines worker.start() + bridge initialization

```typescript
export interface EnableMockingOptions {
  worker: any; // MSW worker instance (required)
  wsEnabled?: boolean; // Enable WebSocket (default: true)
  wsBridgeOptions?: MSWBridgeOptions; // WebSocket bridge config
  workerOptions?: {
    // MSW worker.start() options
    onUnhandledRequest?: 'warn' | 'error' | 'bypass';
    quiet?: boolean;
    serviceWorker?: { url: string };
  };
}

export async function enableMocking(
  options: EnableMockingOptions,
): Promise<any> {
  // Only run in development
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'development'
  ) {
    return;
  }

  const { worker, wsEnabled = true, wsBridgeOptions, workerOptions } = options;

  // Start MSW worker
  await worker.start(
    workerOptions || {
      onUnhandledRequest: 'bypass',
      quiet: false,
    },
  );

  // Initialize WebSocket bridge if enabled
  if (wsEnabled) {
    try {
      const bridge = createMSWBridge(worker, wsBridgeOptions);
      if (bridge && typeof window !== 'undefined') {
        window.__mswBridge = bridge;
        console.log('[MSW] WebSocket bridge initialized');
      }
    } catch (error) {
      console.warn('[MSW] Failed to initialize WebSocket bridge:', error);
    }
  }

  return worker;
}
```

**File: `src/client/index.ts`**

- Public API exports

```typescript
export { MSWWebSocketBridge, createMSWBridge } from './websocket-bridge';
export type { MSWBridgeOptions } from './websocket-bridge';
export { enableMocking } from './enable-mocking';
export type { EnableMockingOptions } from './enable-mocking';
```

#### Task 1.2: Configure Dual Build System

**File: `tsconfig.client.json`** (NEW)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ES2020",
    "outDir": "build/client",
    "rootDir": "src/client",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/client/**/*"],
  "exclude": ["node_modules", "build"]
}
```

**File: `package.json`** (UPDATE)

```json
{
  "name": "msw-mcp",
  "version": "1.1.0",
  "type": "module",
  "main": "build/index.js",
  "exports": {
    ".": {
      "types": "./build/index.d.ts",
      "default": "./build/index.js"
    },
    "./client": {
      "types": "./build/client/index.d.ts",
      "default": "./build/client/index.js"
    }
  },
  "files": ["build/", "templates/", "README.md", "LICENSE"],
  "scripts": {
    "build": "npm run build:server && npm run build:client",
    "build:server": "tsc -p tsconfig.json",
    "build:client": "tsc -p tsconfig.client.json",
    "watch": "tsc --watch",
    "watch:client": "tsc -p tsconfig.client.json --watch",
    "dev": "npm run build && node build/index.js",
    "start": "node build/index.js",
    "prepublishOnly": "npm run build",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  },
  "peerDependencies": {
    "msw": "^2.11.0"
  },
  "peerDependenciesMeta": {
    "msw": {
      "optional": true
    }
  }
}
```

#### Task 1.3: Create Scaffolding Templates

**File: `templates/mocks/handlers.js.template`**

```javascript
import { http, HttpResponse } from 'msw';

// Base handlers - committed to git
// Add your API handlers here
const baseHandlers = [
  // Example:
  // http.get('/api/user', () => {
  //   return HttpResponse.json({ id: 1, name: 'John Doe' })
  // }),
];

// Import custom handlers (local only, gitignored)
let customHandlers = [];
try {
  const customModule = await import('./custom-handlers/index.js');
  customHandlers = customModule.handlers || [];
} catch (error) {
  console.log('[MSW] No custom handlers found (this is normal)');
}

export const handlers = [...baseHandlers, ...customHandlers];
```

**File: `templates/mocks/browser.js.template`**

```javascript
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

**File: `templates/mocks/index.js.template`**

```javascript
import { enableMocking } from 'msw-mcp/client';
import { worker } from './browser';

export async function initMocks() {
  // Only enable in development
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Check if MSW is enabled via environment variable
  const isMSWEnabled =
    process.env.ENABLE_MSW_MOCK === '1' ||
    process.env.ENABLE_MSW_MOCK === 'true';

  if (!isMSWEnabled) {
    console.log('[MSW] Mocking disabled via ENABLE_MSW_MOCK');
    return;
  }

  // Check if WebSocket bridge is enabled
  const isWSEnabled =
    process.env.ENABLE_MSW_WS_MOCK === '1' ||
    process.env.ENABLE_MSW_WS_MOCK === 'true';

  return enableMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789',
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '/mockServiceWorker.js', // Adjust path if needed
      },
    },
  });
}
```

**File: `templates/mocks/custom-handlers/index.example.js.template`**

```javascript
import { http, HttpResponse, bypass } from 'msw';

// Example custom handlers - copy this file to index.js to use
// These handlers are gitignored and won't be committed
export const handlers = [
  // Example: Fetch original data and modify response
  http.get('/api/example', async ({ request }) => {
    const response = await fetch(bypass(request));
    const originalData = await response.json();

    return HttpResponse.json({
      ...originalData,
      ws_mocked: true,
    });
  }),
];
```

**File: `templates/.gitignore-addition.txt`**

```
# MSW local-only custom handlers
mocks/custom-handlers/
!mocks/custom-handlers/index.example.js
```

**File: `templates/.env.example.txt`**

```bash
# MSW Configuration
ENABLE_MSW_MOCK=true
ENABLE_MSW_WS_MOCK=true
MCP_SERVER_URL=ws://localhost:6789
```

#### Task 1.4: Test Client Package Build

- Run `npm run build` to verify both server and client compile
- Check `build/client/` contains all expected files with types
- Verify no TypeScript errors

### Phase 2: Add MCP `/msw-setup` Prompt (2 tasks)

#### Task 2.1: Create Prompt Helper

**File: `src/prompts/msw-setup.ts`**

```typescript
export function createMSWSetupPrompt() {
  return {
    name: 'msw-setup',
    description:
      'Setup MSW (Mock Service Worker) with AI-driven dynamic handler support in your web application',
    arguments: [
      {
        name: 'framework',
        description:
          'Framework type (react/vue/svelte/vanilla) - auto-detects if not specified',
        required: false,
      },
      {
        name: 'serviceWorkerPath',
        description:
          'Custom service worker URL path (default: /mockServiceWorker.js)',
        required: false,
      },
    ],
    async getPrompt(args?: { framework?: string; serviceWorkerPath?: string }) {
      const framework = args?.framework || 'auto-detect';
      const swPath = args?.serviceWorkerPath || '/mockServiceWorker.js';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are setting up MSW (Mock Service Worker) with AI-driven dynamic handler support for a ${framework} web application.

## Setup Mode Detection

First, check if MSW is already set up:
- If \`mocks/\` directory exists → **MIGRATION MODE**
- If \`mocks/\` directory does NOT exist → **NEW PROJECT MODE**

---

## NEW PROJECT MODE (No existing mocks/)

### 1. Check Dependencies
- Verify if \`msw\` is in package.json
  - If NOT installed: Guide user to run \`npm install -D msw@^2.11.0\`
- Verify if \`msw-mcp\` is in package.json
  - If NOT installed: Guide user to run \`npm install -D msw-mcp\`

### 2. Initialize MSW Service Worker
- Check if \`mockServiceWorker.js\` exists in public directory
- If NOT exists: Guide user to run \`npx msw init public/ --save\`
  - Adjust path based on framework (e.g., \`public/\` for React/Vue, \`static/\` for Svelte)

### 3. Create Complete Mocks Directory Structure

Create all files from scratch:

**mocks/handlers.js**:
\`\`\`javascript
import { http, HttpResponse } from 'msw'

// Base handlers - committed to git
const baseHandlers = [
  // Add your API handlers here
]

// Import custom handlers (local only, gitignored)
let customHandlers = []
try {
  const customModule = await import('./custom-handlers/index.js')
  customHandlers = customModule.handlers || []
} catch (error) {
  console.log('[MSW] No custom handlers found (this is normal)')
}

export const handlers = [...baseHandlers, ...customHandlers]
\`\`\`

**mocks/browser.js**:
\`\`\`javascript
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
\`\`\`

**mocks/index.js**:
\`\`\`javascript
import { enableMocking } from 'msw-mcp/client'
import { worker } from './browser'

export async function initMocks() {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const isMSWEnabled =
    process.env.ENABLE_MSW_MOCK === '1' ||
    process.env.ENABLE_MSW_MOCK === 'true'

  if (!isMSWEnabled) {
    console.log('[MSW] Mocking disabled via ENABLE_MSW_MOCK')
    return
  }

  const isWSEnabled =
    process.env.ENABLE_MSW_WS_MOCK === '1' ||
    process.env.ENABLE_MSW_WS_MOCK === 'true'

  return enableMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789'
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '${swPath}'
      }
    }
  })
}
\`\`\`

**mocks/custom-handlers/index.example.js**:
\`\`\`javascript
import { http, HttpResponse, bypass } from 'msw'

// Copy this file to index.js and customize
export const handlers = [
  http.get('/api/example', async ({ request }) => {
    const response = await fetch(bypass(request))
    const data = await response.json()
    return HttpResponse.json({ ...data, ws_mocked: true })
  })
]
\`\`\`

### 4. Update .gitignore
Add these lines:
\`\`\`
# MSW local-only custom handlers
mocks/custom-handlers/
!mocks/custom-handlers/index.example.js
\`\`\`

### 5. Create/Update Environment Files

**.env.example**:
\`\`\`bash
ENABLE_MSW_MOCK=true
ENABLE_MSW_WS_MOCK=true
MCP_SERVER_URL=ws://localhost:6789
\`\`\`

**.env.local** (create if doesn't exist):
\`\`\`bash
ENABLE_MSW_MOCK=true
ENABLE_MSW_WS_MOCK=true
MCP_SERVER_URL=ws://localhost:6789
\`\`\`

### 6. Integrate into App Entry Point

Auto-detect entry file based on framework:
- React: \`src/main.jsx\` or \`src/index.jsx\`
- Vue: \`src/main.js\`
- Svelte: \`src/main.js\`

Update the entry file:
\`\`\`javascript
import { initMocks } from '../mocks'

async function startApp() {
  await initMocks()

  // ... rest of app initialization
}

startApp()
\`\`\`

### 7. Provide Test Instructions
Tell user: "Setup complete! To test, run your dev server and I can add a test handler for you."

---

## MIGRATION MODE (Existing mocks/ directory found)

### 1. Confirm Migration
Ask user: "I found existing MSW setup. Would you like me to migrate to use msw-mcp/client? This will:"
- Keep your existing handlers.js and custom-handlers/ unchanged
- Update imports to use msw-mcp/client
- Delete websocket-bridge.js (replaced by import)

### 2. Check Dependencies
- Verify \`msw-mcp\` is in package.json
  - If NOT: Guide user to run \`npm install -D msw-mcp\`

### 3. Migration Steps (if user confirms)

**A. Delete websocket-bridge.js** (if it exists)

**B. Update mocks/index.js**:
Replace existing enableMocking logic with:
\`\`\`javascript
import { enableMocking } from 'msw-mcp/client'
import { worker } from './browser'

export async function initMocks() {
  if (process.env.NODE_ENV !== 'development') {
    return
  }

  const isMSWEnabled =
    process.env.ENABLE_MSW_MOCK === '1' ||
    process.env.ENABLE_MSW_MOCK === 'true'

  if (!isMSWEnabled) {
    console.log('[MSW] Mocking disabled')
    return
  }

  const isWSEnabled =
    process.env.ENABLE_MSW_WS_MOCK === '1' ||
    process.env.ENABLE_MSW_WS_MOCK === 'true'

  return enableMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789'
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '${swPath}' // Keep existing path
      }
    }
  })
}
\`\`\`

**C. Keep handlers.js unchanged** - Do NOT modify

**D. Keep custom-handlers/ unchanged** - Do NOT modify

**E. Update .env files** (if not already correct):
- Ensure ENABLE_MSW_MOCK, ENABLE_MSW_WS_MOCK, MCP_SERVER_URL are set

### 4. Verify Migration
Tell user: "Migration complete! Your existing handlers are preserved. Test by running your dev server."

---

## Important Guidelines

- **Be concise** - Execute tasks directly without excessive explanation
- **Auto-detect framework** - Check package.json for react/vue/svelte/etc
- **Use Write tool** - Create files using Write tool, NOT bash/echo commands
- **Check before creating** - Use Read to check if files exist before overwriting
- **Preserve user code** - In migration mode, NEVER modify handlers.js or custom-handlers/
- **Adapt paths** - Adjust service worker path and public directory based on framework

Begin setup now.`,
            },
          },
        ],
      };
    },
  };
}
```

#### Task 2.2: Register Prompt in MCP Server

**File: `src/index.ts`** (UPDATE)

Add import:

```typescript
import { createMSWSetupPrompt } from './prompts/msw-setup.js';
```

After tool registration (around line 163), add:

```typescript
// Register prompts
const setupPrompt = createMSWSetupPrompt();
server.registerPrompt(
  setupPrompt.name,
  setupPrompt.description,
  setupPrompt.arguments,
  setupPrompt.getPrompt,
);
```

### Phase 3: Update Documentation (1 task)

#### Task 3.1: Update README

Add new sections to README.md:

1. **Quick Start with `/msw-setup`** (add after installation section)
2. **Client Package API Reference** (new section)
3. **Manual Installation Guide** (for those not using /msw-setup)
4. **Migration Guide** (for existing projects)
5. **Framework-Specific Examples** (React, Vue, Svelte)

### Phase 4: Migrate Existing Project (1 task)

#### Task 4.1: Migrate bili/ad-manager-ultimate-fe

1. Add dependency: `npm install -D file:../msw-mcp` (local link for testing)
2. Delete `mocks/websocket-bridge.js`
3. Update `mocks/index.js` to use `enableMocking` from `msw-mcp/client`
4. Keep `mocks/handlers.js` unchanged
5. Keep `mocks/custom-handlers/` unchanged
6. Test: Start dev server and verify handlers still work
7. Test: Add handler via MCP tools and verify WebSocket bridge works

## ✅ Success Criteria

- [ ] `import { createMSWBridge } from 'msw-mcp/client'` works
- [ ] `import { enableMocking } from 'msw-mcp/client'` works
- [ ] TypeScript types exported correctly
- [ ] Build produces both server and client outputs (build/ and build/client/)
- [ ] `/msw-setup` prompt registered and appears in MCP client
- [ ] `/msw-setup` creates complete working structure for new projects
- [ ] `/msw-setup` migrates existing projects correctly
- [ ] `/msw-setup` auto-detects framework from package.json
- [ ] bili project migrated successfully with all handlers working
- [ ] WebSocket bridge functionality preserved
- [ ] README has comprehensive examples for all use cases
- [ ] Client bundle size < 20KB gzipped

## 📊 Pros & Cons Summary

### ✅ Pros

1. **Automated Setup** - `/msw-setup` scaffolds entire structure in seconds
2. **Zero Copy-Paste** - Import 350+ line bridge from package
3. **Version Sync** - Client and server always compatible
4. **Type Safety** - Full TypeScript support
5. **Flexible Config** - Options API replaces hardcoded env vars
6. **Scalable** - Easy to add to any new project
7. **MCP Native** - Prompt is exposed as official MCP feature
8. **Consistent** - All projects use same proven setup

### ⚠️ Cons & Mitigations

1. **Bundle Size** - Client code added to app bundle
   - _Mitigation_: Dev-only code, tree-shakeable, ~15-20KB gzipped

2. **Build Complexity** - Dual TypeScript compilation
   - _Mitigation_: Simple separate configs, clear build order

3. **Breaking Changes** - API updates affect all consumers
   - _Mitigation_: Semantic versioning, clear migration guides

4. **Peer Dependency** - Requires matching MSW version
   - _Mitigation_: Marked optional, clear error messages

5. **Framework Variations** - Different entry points per framework
   - _Mitigation_: `/msw-setup` auto-detects and adapts

## 🔄 Task Execution Order

1. Phase 1.1 - Create TypeScript client code
2. Phase 1.2 - Configure dual build system
3. Phase 1.3 - Create scaffolding templates
4. Phase 1.4 - Test client package build
5. Phase 2.1 - Create prompt helper
6. Phase 2.2 - Register prompt in MCP server
7. Phase 3.1 - Update README
8. Phase 4.1 - Migrate bili project

## 📝 Notes

- Templates in `templates/` directory are NOT executed code - they are scaffolding resources
- The `/msw-setup` prompt tells AI how to create files, AI does the actual file creation
- Migration mode preserves all user customizations in handlers
- Environment variables remain the preferred config method for users
