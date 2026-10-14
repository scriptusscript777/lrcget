import { describe, expect, it } from 'vitest'
import { countUnconfirmedWordAdjustments, wordTimingFingerprint } from './word-timing-state.js'

const lines = [
  {
    start_ms: 1000,
    end_ms: 3000,
    words: [
      { text: 'one ', start_ms: 1000, end_ms: 1800 },
      { text: 'two', start_ms: 1800 },
    ],
  },
]

describe('pending word timing state', () => {
  it('counts only matching current adjustments that have not been confirmed', () => {
    const first = wordTimingFingerprint(0, lines[0].words, 0, lines[0].end_ms)
    const second = wordTimingFingerprint(0, lines[0].words, 1, lines[0].end_ms)
    expect(
      countUnconfirmedWordAdjustments(
        lines,
        [
          ['0:0', first],
          ['0:1', second],
          ['9:9', 'stale'],
        ],
        [['0:0', first]]
      )
    ).toBe(1)
  })

  it('ignores stale or malformed adjustment records', () => {
    expect(
      countUnconfirmedWordAdjustments(lines, [['0:0', 'stale'], null, ['bad']], [])
    ).toBe(0)
  })
})
