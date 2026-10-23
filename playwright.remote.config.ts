import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.UPLOADER_BASE_URL ?? 'https://file-uploader-demo.meggigoatee.workers.dev';
const rehearsal = baseURL === 'http://127.0.0.1:4173';
export default defineConfig({
  testDir:'./tests/remote', workers:1, retries:0, timeout:60000,
  reporter:[['list']],
  use:{baseURL,trace:'retain-on-failure',actionTimeout:10000,...devices['Desktop Chrome']},
  ...(rehearsal ? { webServer: { command: 'pnpm exec vite --mode e2e --host 127.0.0.1 --port 4173 --strictPort', url: baseURL, reuseExistingServer: false, timeout: 30000 } } : {}),
});
