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

## Project Detection

First, analyze the project:

### 1. Detect Build Tool and Configuration
Read \`package.json\` and check dependencies:
- **Vite**: \`vite\` in devDependencies → Public dir: \`public/\`, Config: \`vite.config.js/ts\`
- **Rspack**: \`@rspack/core\` or \`@rspack/cli\` → Public dir: \`static/\` or \`public/\`, Config: \`rspack.config.js\`
- **Rsbuild**: \`@rsbuild/core\` → Public dir: \`public/\`, Config: \`rsbuild.config.js/ts\`
- **Webpack**: \`webpack\` (fallback) → Public dir: \`public/\` or \`static/\`, Config: \`webpack.config.js\`

### 1a. Detect publicPath from Bundler Config
Read the bundler config file to find the publicPath for dev server:

**For Vite (\`vite.config.js/ts\`):**
- Look for \`base\` option in config
- Examples:
  - \`base: '/app'\` → Service worker URL: \`/app/mockServiceWorker.js\`
  - \`base: '/app/'\` → Service worker URL: \`/app/mockServiceWorker.js\` (strip trailing slash)

**For Rspack (\`rspack.config.js\`):**
- Look for \`output.publicPath\` or \`devServer.publicPath\`
- Check both development and production modes
- Examples:
  - \`publicPath: '/app'\` → Service worker URL: \`/app/mockServiceWorker.js\`
  - \`publicPath: '/app/'\` → Service worker URL: \`/app/mockServiceWorker.js\` (strip trailing slash)

**For Rsbuild (\`rsbuild.config.js/ts\`):**
- Look for \`output.assetPrefix\` or \`dev.assetPrefix\`
- Examples:
  - \`assetPrefix: '/app'\` → Service worker URL: \`/app/mockServiceWorker.js\`
  - \`assetPrefix: '/app/'\` → Service worker URL: \`/app/mockServiceWorker.js\` (strip trailing slash)

**For Webpack (\`webpack.config.js\`):**
- Look for \`output.publicPath\` in devServer config
- Examples:
  - \`publicPath: '/app'\` → Service worker URL: \`/app/mockServiceWorker.js\`
  - \`publicPath: '/app/'\` → Service worker URL: \`/app/mockServiceWorker.js\` (strip trailing slash)

**publicPath Normalization Rules:**
1. If publicPath ends with \`/\`, remove the trailing slash
2. If publicPath is \`/\` or empty, use \`/mockServiceWorker.js\`
3. Otherwise, use \`{normalizedPublicPath}/mockServiceWorker.js\`
4. Always ensure the result starts with \`/\`

**Examples:**
- \`/app\` → \`/app/mockServiceWorker.js\` ✅
- \`/app/\` → \`/app/mockServiceWorker.js\` ✅ (trailing slash removed)
- \`/\` → \`/mockServiceWorker.js\` ✅
- \`""\` (empty) → \`/mockServiceWorker.js\` ✅
- \`/my-project\` → \`/my-project/mockServiceWorker.js\` ✅
- \`/my-project/\` → \`/my-project/mockServiceWorker.js\` ✅

### 2. Detect TypeScript Support
Check if project uses TypeScript:
- Look for \`typescript\` in devDependencies
- Look for \`tsconfig.json\` in project root
- If either exists → Generate \`.ts\` files, otherwise \`.js\` files

### 3. Determine File Extension
- TypeScript detected → Use \`.ts\` extension
- No TypeScript → Use \`.js\` extension

### 4. Check Setup Mode
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
- Check if \`mockServiceWorker.js\` exists in detected public directory
- If NOT exists: Guide user to run \`npx msw init <public-dir>/ --save\`
  - Use detected public directory from step 1
  - Example: \`npx msw init static/ --save\` for Rspack with static/ directory

### 3. Create Complete Mocks Directory Structure

Create all files with appropriate extension (.js or .ts based on TypeScript detection):

**For JavaScript Projects (mocks/handlers.js):**
\`\`\`javascript
/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
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

**For TypeScript Projects (mocks/handlers.ts):**
\`\`\`typescript
/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import { http, HttpResponse, type RequestHandler } from 'msw'

// Base handlers - committed to git
const baseHandlers: RequestHandler[] = [
  // Add your API handlers here
]

// Import custom handlers (local only, gitignored)
let customHandlers: RequestHandler[] = []
try {
  const customModule = await import('./custom-handlers/index.js')
  customHandlers = customModule.handlers || []
} catch (error) {
  console.log('[MSW] No custom handlers found (this is normal)')
}

export const handlers: RequestHandler[] = [...baseHandlers, ...customHandlers]
\`\`\`

**For JavaScript Projects (mocks/browser.js):**
\`\`\`javascript
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
\`\`\`

**For TypeScript Projects (mocks/browser.ts):**
\`\`\`typescript
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
\`\`\`

**For JavaScript Projects (mocks/index.js):**
\`\`\`javascript
import { initMocking } from 'msw-mcp/client'
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

  return initMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789'
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '<DETECTED_PUBLIC_PATH>/mockServiceWorker.js' // Use detected publicPath + /mockServiceWorker.js
      }
    }
  })
}
\`\`\`

**IMPORTANT**: Replace \`<DETECTED_PUBLIC_PATH>/mockServiceWorker.js\` with the actual path:
- If publicPath detected (e.g., \`/app\` or \`/app/\`): Normalize and use \`/app/mockServiceWorker.js\`
- If no publicPath or publicPath is \`/\`: Use \`/mockServiceWorker.js\`
- Always strip trailing slashes from publicPath before concatenating

**For TypeScript Projects (mocks/index.ts):**
\`\`\`typescript
import { initMocking, type InitMockingOptions } from 'msw-mcp/client'
import { worker } from './browser'

export async function initMocks(): Promise<void> {
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

  await initMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789'
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '<DETECTED_PUBLIC_PATH>/mockServiceWorker.js' // Use detected publicPath + /mockServiceWorker.js
      }
    }
  })
}
\`\`\`

**IMPORTANT**: Replace \`<DETECTED_PUBLIC_PATH>/mockServiceWorker.js\` with the actual path (same as JavaScript version)

**For JavaScript Projects (mocks/custom-handlers/index.example.js):**
\`\`\`javascript
import { http, HttpResponse, bypass } from 'msw'

// Example custom handlers - copy this file to index.js and customize
export const handlers = [
  http.get('/api/example', async ({ request }) => {
    const response = await fetch(bypass(request))
    const data = await response.json()
    return HttpResponse.json({ ...data, ws_mocked: true })
  })
]
\`\`\`

**For TypeScript Projects (mocks/custom-handlers/index.example.ts):**
\`\`\`typescript
import { http, HttpResponse, bypass, type RequestHandler } from 'msw'

// Example custom handlers - copy this file to index.ts and customize
export const handlers: RequestHandler[] = [
  http.get('/api/example', async ({ request }) => {
    const response = await fetch(bypass(request))
    const data = await response.json()
    return HttpResponse.json({ ...data, ws_mocked: true })
  })
]
\`\`\`

**IMPORTANT: Also create mocks/custom-handlers/index.js (or index.ts for TypeScript)**

Copy the example file to prevent Vite/ESLint pre-compile errors:

**For JavaScript:**
\`\`\`javascript
import { http, HttpResponse, bypass } from 'msw'

// Custom handlers for local development only (gitignored)
// Uncomment and modify the example below, or add your own handlers
export const handlers = [
  // http.get('/api/example', async ({ request }) => {
  //   const response = await fetch(bypass(request))
  //   const data = await response.json()
  //   return HttpResponse.json({ ...data, ws_mocked: true })
  // })
]
\`\`\`

**For TypeScript:**
\`\`\`typescript
import { http, HttpResponse, bypass, type RequestHandler } from 'msw'

// Custom handlers for local development only (gitignored)
// Uncomment and modify the example below, or add your own handlers
export const handlers: RequestHandler[] = [
  // http.get('/api/example', async ({ request }) => {
  //   const response = await fetch(bypass(request))
  //   const data = await response.json()
  //   return HttpResponse.json({ ...data, ws_mocked: true })
  // })
]
\`\`\`

**Why create index.js/ts?**
- Prevents "Failed to resolve import" errors in Vite
- Avoids ESLint warnings during build
- Provides a ready-to-use template with example commented out

### 4. Update .gitignore
Add these lines to gitignore the custom handler index files but keep examples:
\`\`\`
# MSW local-only custom handlers
mocks/custom-handlers/index.js
mocks/custom-handlers/index.ts
\`\`\`

**Note**: This gitignores only the \`index.js/ts\` files while keeping \`index.example.js/ts\` in git.

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

### 7. Provide Setup Complete Message
Tell user:
\`\`\`
✅ MSW setup complete!

Files created:
- mocks/handlers.{js/ts} - Base handlers (committed)
- mocks/browser.{js/ts} - Worker setup
- mocks/index.{js/ts} - Initialization
- mocks/custom-handlers/index.example.{js/ts} - Example handlers
- mocks/custom-handlers/index.{js/ts} - Your local handlers (gitignored, ready to use)

Next steps:
1. Run your dev server to activate MSW
2. Edit mocks/custom-handlers/index.{js/ts} to add your custom handlers
3. I can help you add test handlers once the server is running!
\`\`\`

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

**B. Update mocks/index.js or mocks/index.ts**:
Replace existing enableMocking logic with initMocking:

**For JavaScript:**
\`\`\`javascript
import { initMocking } from 'msw-mcp/client'
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

  return initMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789'
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '<DETECTED_PUBLIC_PATH>/mockServiceWorker.js' // Use detected publicPath
      }
    }
  })
}
\`\`\`

**For TypeScript:**
\`\`\`typescript
import { initMocking } from 'msw-mcp/client'
import { worker } from './browser'

export async function initMocks(): Promise<void> {
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

  await initMocking({
    worker,
    wsEnabled: isWSEnabled,
    wsBridgeOptions: {
      url: process.env.MCP_SERVER_URL || 'ws://localhost:6789'
    },
    workerOptions: {
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: '<DETECTED_PUBLIC_PATH>/mockServiceWorker.js' // Use detected publicPath
      }
    }
  })
}
\`\`\`

**IMPORTANT**: Detect publicPath from bundler config and replace \`<DETECTED_PUBLIC_PATH>/mockServiceWorker.js\`:
- Read existing serviceWorker.url to see if there's already a custom path
- If custom path exists, preserve it
- Otherwise, use detected publicPath from step 1a

**C. Keep handlers.js unchanged** - Do NOT modify

**D. Keep custom-handlers/ unchanged** - Do NOT modify

**E. Update .env files** (if not already correct):
- Ensure ENABLE_MSW_MOCK, ENABLE_MSW_WS_MOCK, MCP_SERVER_URL are set

### 4. Verify Migration
Tell user: "Migration complete! Your existing handlers are preserved. Test by running your dev server."

---

## Important Guidelines

- **Detect first** - Always read package.json first to detect build tool and TypeScript
- **Detect publicPath** - Read bundler config file to find publicPath for service worker URL
- **Use correct extensions** - Generate .ts files for TypeScript projects, .js for JavaScript
- **Be concise** - Execute tasks directly without excessive explanation
- **Auto-detect framework** - Check package.json for react/vue/svelte/etc
- **Use Write tool** - Create files using Write tool, NOT bash/echo commands
- **Check before creating** - Use Read to check if files exist before overwriting
- **Preserve user code** - In migration mode, NEVER modify handlers.js/ts or custom-handlers/
- **Adapt paths** - Adjust service worker path and public directory based on detected build tool
- **TypeScript imports** - Use proper type imports in .ts files (e.g., \`type RequestHandler\`)
- **Handle slashes** - When constructing service worker URL, normalize publicPath first:
  - Strip trailing slash: \`/app/\` → \`/app\`
  - Then concatenate: \`/app\` + \`/mockServiceWorker.js\` → \`/app/mockServiceWorker.js\`
  - Special cases: \`/\` or empty → \`/mockServiceWorker.js\`

## Detection Steps Summary

1. Read package.json → Detect build tool
2. Read bundler config file → Extract publicPath
3. Check for tsconfig.json → Detect TypeScript
4. Check for mocks/ directory → Determine setup mode
5. Construct service worker URL with detected publicPath
6. Generate files with correct extensions and paths

Begin setup now by reading package.json to detect build tool and TypeScript support.`,
            },
          },
        ],
      };
    },
  };
}
