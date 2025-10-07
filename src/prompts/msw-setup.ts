export function createMSWSetupPrompt() {
  return {
    name: 'msw-setup',
    description:
      'Setup MSW (Mock Service Worker) with AI-driven dynamic handler support in your web application',
    async getPrompt(args?: { framework?: string; serviceWorkerPath?: string }) {
      const framework = args?.framework || 'auto-detect';
      const swPath = args?.serviceWorkerPath || '/mockServiceWorker.js';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
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
