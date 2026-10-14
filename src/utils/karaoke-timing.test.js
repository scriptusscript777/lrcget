import { describe, expect, it } from 'vitest'
import { getCurrentWordIndex } from './karaoke-timing.js'

describe('karaoke word highlighting', () => {
  const line = {
    words: [
      { text: 'Hello ', start_ms: 1000, end_ms: 1450 },
      { text: 'world', start_ms: 1600, end_ms: 2100 },
      { text: '!', start_ms: 2200 },
    ],
  }

  it('highlights a word only within its explicit timing range', () => {
    expect(getCurrentWordIndex(line, 1000)).toBe(0)
    expect(getCurrentWordIndex(line, 1449)).toBe(0)
    expect(getCurrentWordIndex(line, 1450)).toBe(-1)
    expect(getCurrentWordIndex(line, 1599)).toBe(-1)
    expect(getCurrentWordIndex(line, 1600)).toBe(1)
    expect(getCurrentWordIndex(line, 2100)).toBe(-1)
  })

  it('uses the next word start when an end time is absent', () => {
    expect(getCurrentWordIndex({ words: [{ start_ms: 2000 }, { start_ms: 2500 }] }, 2499)).toBe(0)
    expect(getCurrentWordIndex({ words: [{ start_ms: 2000 }, { start_ms: 2500 }] }, 2500)).toBe(1)
  })

  it('handles missing timing and invalid playback positions safely', () => {
    expect(getCurrentWordIndex({ words: [{ text: 'untimed' }] }, 1000)).toBe(-1)
    expect(getCurrentWordIndex(line, Number.NaN)).toBe(-1)
    expect(getCurrentWordIndex(null, 1000)).toBe(-1)
  })
})
