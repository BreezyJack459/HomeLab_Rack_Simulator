import { defineConfig, devices } from '@playwright/test';

const production = process.env.PLAYWRIGHT_PRODUCTION === '1';
const serverUrl = production ? 'http://127.0.0.1:5174' : 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: serverUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: production ? 'npm run preview -- --host 127.0.0.1 --port 5174 --strictPort' : 'npm run dev',
    url: serverUrl,
    reuseExistingServer: !production && !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
