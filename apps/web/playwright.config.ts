import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

// Widths from ROADMAP.md: phone 390, tablet 768, desktop 1440.
const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'off' },
  projects: viewports.map((v) => ({
    name: v.name,
    use: { ...devices['Desktop Chrome'], viewport: { width: v.width, height: v.height } },
  })),
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    // Never reuse: a stale server from an older build serves missing chunks and breaks hydration.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
