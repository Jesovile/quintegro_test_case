import { makeConfig } from './config-factory'

// Main suite: backend 3100, frontend 3101
export default makeConfig({ testMatch: '0*.spec.ts', backendPort: 3100, frontendPort: 3101 })
