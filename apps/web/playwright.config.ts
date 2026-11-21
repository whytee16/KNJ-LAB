import nextEnv from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Tests that create accounts need the same Supabase settings as the app (.env.local).
nextEnv.loadEnvConfig(process.cwd());

const PORT = Number(process.env.E2E_PORT ?? 3100);

// Widths from ROADMAP.md: phone 390, tablet 768, desktop 1440.
const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'off' },
  projects: [
    ...viewports.map((v) => ({
      name: v.name,
      testIgnore: /(auth|content)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: v.width, height: v.height } },
    })),
    // Account and content lifecycles need the local Supabase stack (pnpm db:start); one viewport is enough.
    {
      name: 'accounts',
      testMatch: /(auth|content)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    // Never reuse: a stale server from an older build serves missing chunks and breaks hydration.
    reuseExistingServer: false,
    timeout: 60_000,
    // Links in auth e-mails must point back at this server.
    env: { APP_URL: `http://127.0.0.1:${PORT}` },
  },
});
