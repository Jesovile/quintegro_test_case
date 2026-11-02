import { makeConfig } from './config-factory'

// Fresh backend 3102 / frontend 3103: processing fails once, then the retry succeeds
export default makeConfig({ testMatch: 'fail-retry.spec.ts', backendPort: 3102, frontendPort: 3103 })
