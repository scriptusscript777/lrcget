import { describe, expect, it } from 'vitest'
import { activeWordIndex } from './word-playback.js'

describe('explicit word playback ends', () => {
  const line = {
    start_ms: 1000,
    end_ms: 4000,
    words: [
      { text: 'one ', start_ms: 1000, end_ms: 1500 },
      { text: 'two', start_ms: 2000, end_ms: 2500 },
    ],
  }
  it('uses half-open word intervals and does not return an earlier word during silence', () => {
    for (const [time, expected] of [
      [999, -1],
      [1000, 0],
      [1499, 0],
      [1500, -1],
      [1999, -1],
      [2000, 1],
      [2499, 1],
      [2500, -1],
      [3999, -1],
    ])
      expect(activeWordIndex(line, time)).toBe(expected)
  })
  it('keeps ordinary LRC words active until the next start or inferred line end', () => {
    const ordinary = {
      ...line,
      end_ms: undefined,
      words: line.words.map(({ text, start_ms }) => ({ text, start_ms })),
    }
    expect(activeWordIndex(ordinary, 1999)).toBe(0)
    expect(activeWordIndex(ordinary, 3500, { inferredEndMs: 4000 })).toBe(1)
    expect(activeWordIndex(ordinary, 4000, { inferredEndMs: 4000 })).toBe(-1)
  })
})
