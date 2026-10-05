import { defineConfig } from '@playwright/test';
import * as path from 'path';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'test-results', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL:
      process.env.BASE_URL ??
      `file://${path.resolve(__dirname, 'emi-calculator.html')}`,
    screenshot: 'on',
    video: 'off',
    headless: true,
  },
});
