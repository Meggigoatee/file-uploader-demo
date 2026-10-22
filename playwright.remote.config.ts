import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/remote', workers:1, retries:0, timeout:60000,
  reporter:[['list']],
  use:{baseURL:'https://file-uploader-demo.meggigoatee.workers.dev',trace:'retain-on-failure',actionTimeout:10000,...devices['Desktop Chrome']},
});
