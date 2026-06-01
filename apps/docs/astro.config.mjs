// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'MSW Agent Tools',
      description:
        'CLI and MCP tools for live Mock Service Worker control — update API mocks in your browser without reloading.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/JasonBoy/msw-mcp',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'msw-cli',
          items: [
            { label: 'Overview', slug: 'msw-cli/overview' },
            { label: 'Commands', slug: 'msw-cli/commands' },
            { label: 'Session Management', slug: 'msw-cli/sessions' },
          ],
        },
        {
          label: 'msw-mcp',
          items: [
            { label: 'Overview', slug: 'msw-mcp/overview' },
            { label: 'MCP Tools', slug: 'msw-mcp/tools' },
            { label: 'Configuration', slug: 'msw-mcp/configuration' },
            { label: '/msw-setup Prompt', slug: 'msw-mcp/prompt' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
