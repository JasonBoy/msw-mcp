import { describe, it, expect } from 'vitest';
import { loadMswSetupPrompt } from './msw-setup-prompt.js';

describe('loadMswSetupPrompt', () => {
  it('substitutes framework and service worker path placeholders', () => {
    const prompt = loadMswSetupPrompt({
      framework: 'vite',
      serviceWorkerPath: '/custom-sw.js',
    });

    expect(prompt).toContain('vite web application');
    expect(prompt).toContain('/custom-sw.js');
    expect(prompt).not.toContain('{{framework}}');
    expect(prompt).not.toContain('{{serviceWorkerPath}}');
  });

  it('applies defaults when no options are given', () => {
    const prompt = loadMswSetupPrompt();

    expect(prompt).toContain('auto-detect web application');
    expect(prompt).toContain('/mockServiceWorker.js');
  });

  it('replaces all occurrences of a placeholder', () => {
    const prompt = loadMswSetupPrompt({ framework: 'next' });
    expect(prompt).not.toContain('{{framework}}');
  });
});
