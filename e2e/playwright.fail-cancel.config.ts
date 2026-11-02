import { makeConfig } from './config-factory'

// Fresh backend 3104 / frontend 3105: processing fails, the paid order is cancelled from History with a refund
export default makeConfig({ testMatch: 'fail-cancel.spec.ts', backendPort: 3104, frontendPort: 3105 })
