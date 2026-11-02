import { describe, expect, it } from 'vitest'
import { nextTabIndex } from './tabs'

describe('tab list keyboard model', () => {
  it('moves with the arrow keys and wraps around', () => {
    expect(nextTabIndex(0, 'ArrowRight', 2)).toBe(1)
    expect(nextTabIndex(1, 'ArrowRight', 2)).toBe(0)
    expect(nextTabIndex(0, 'ArrowLeft', 2)).toBe(1)
  })

  it('jumps to the first and last tab', () => {
    expect(nextTabIndex(1, 'Home', 3)).toBe(0)
    expect(nextTabIndex(0, 'End', 3)).toBe(2)
  })

  it('ignores other keys', () => {
    expect(nextTabIndex(0, 'Enter', 2)).toBeNull()
    expect(nextTabIndex(0, 'Tab', 2)).toBeNull()
  })
})
