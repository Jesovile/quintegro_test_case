// Runs the three Playwright configs one after another and fails if any of them failed
import { spawnSync } from 'node:child_process'

const configs = ['playwright.config.ts', 'playwright.fail-retry.config.ts', 'playwright.fail-cancel.config.ts']
const extra = process.argv.slice(2)
let failed = false
for (const config of configs) {
  const r = spawnSync('npx', ['playwright', 'test', '-c', config, ...extra], { stdio: 'inherit', shell: true })
  if (r.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
