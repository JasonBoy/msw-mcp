import { loadMswSetupPrompt } from '@msw-mcp/core';

export function createMSWSetupPrompt() {
  return {
    name: 'msw-setup',
    description:
      'Setup MSW (Mock Service Worker) with AI-driven dynamic handler support in your web application',
    async getPrompt(args?: { framework?: string; serviceWorkerPath?: string }) {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: loadMswSetupPrompt(args),
            },
          },
        ],
      };
    },
  };
}
