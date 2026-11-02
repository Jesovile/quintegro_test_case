import { describe, expect, it } from 'vitest'
import { formatUsd } from './money'

describe('formatUsd', () => {
  it('formats whole dollars with thousands separators', () => {
    expect(formatUsd(1300)).toBe('$1,300')
  })

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0')
  })
})
