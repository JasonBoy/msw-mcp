import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface MswSetupPromptOptions {
  framework?: string;
  serviceWorkerPath?: string;
}

const DEFAULT_FRAMEWORK = 'auto-detect';
const DEFAULT_SERVICE_WORKER_PATH = '/mockServiceWorker.js';

function getPromptFilePath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(currentDir, '..', 'prompts', 'msw-setup.md');
}

export function loadMswSetupPrompt(
  options: MswSetupPromptOptions = {},
): string {
  const framework = options.framework ?? DEFAULT_FRAMEWORK;
  const serviceWorkerPath =
    options.serviceWorkerPath ?? DEFAULT_SERVICE_WORKER_PATH;

  const template = fs.readFileSync(getPromptFilePath(), 'utf8');

  return template
    .replaceAll('{{framework}}', framework)
    .replaceAll('{{serviceWorkerPath}}', serviceWorkerPath);
}
