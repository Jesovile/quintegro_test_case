import { defineConfig, devices } from '@playwright/test'

// Each config runs its own backend + frontend on its own ports, so a scenario that needs a pristine mock
// service (the "FAIL" street breaks only the first fulfillment job of an order per backend process) gets one.
export function makeConfig(opts: { testMatch: string; backendPort: number; frontendPort: number }) {
  process.env.E2E_API = `http://localhost:${opts.backendPort}`
  return defineConfig({
    testDir: './tests',
    testMatch: opts.testMatch,
    workers: 1,
    fullyParallel: false,
    retries: 0,
    // The backend adds 1.5 s to every request, so flows are long
    timeout: 240_000,
    expect: { timeout: 20_000 },
    reporter: [['list']],
    outputDir: `test-results/port-${opts.frontendPort}`,
    use: {
      baseURL: `http://localhost:${opts.frontendPort}`,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      actionTimeout: 20_000
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: [
      {
        command: 'npm run dev',
        cwd: '../backend',
        url: `http://localhost:${opts.backendPort}/health`,
        env: { PORT: String(opts.backendPort) },
        reuseExistingServer: false,
        timeout: 120_000
      },
      {
        command: `npx vite --port ${opts.frontendPort} --strictPort`,
        cwd: '../frontend',
        url: `http://localhost:${opts.frontendPort}/runtime/`,
        env: { VITE_GRAPHQL_URI: `http://localhost:${opts.backendPort}/graphql` },
        reuseExistingServer: false,
        timeout: 120_000
      }
    ]
  })
}
