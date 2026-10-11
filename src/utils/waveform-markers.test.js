import { describe, expect, it } from 'vitest'
import { waveformMarkerBounds, waveformNeighborWarnings } from './waveform-markers.js'
import { followViewport } from './waveform-viewport.js'

describe('waveform paging', () => {
  it('pages forward and backward, but preserves identity within a page and at the end', () => {
    const view = { start: 0, span: 3 }
    expect(followViewport(10, view, 2.9)).toBe(view)
    expect(followViewport(10, view, NaN)).toBe(view)
    expect(followViewport(10, view, 3)).toEqual({ start: 3, span: 3 })
    const last = followViewport(10, view, 10)
    expect(last).toEqual({ start: 7, span: 3 })
    expect(followViewport(10, last, 10)).toBe(last)
    expect(followViewport(10, last, 1)).toEqual(view)
  })
})

describe('waveform marker constraints', () => {
  const line = { start_ms: 1000, words: [{ start_ms: 1000, end_ms: 3000 }] }
  it('allows a word end exactly at the lyric end without moving either marker', () => {
    expect(waveformMarkerBounds(line, 3000, 10000)).toEqual({
      start: { min: 0, max: 1000 },
      end: { min: 3000, max: 10000 },
    })
    expect(
      waveformMarkerBounds({ start_ms: 1000, words: [{ start_ms: 2999 }] }, 3000, 10000).end.min
    ).toBe(3000)
  })
  it.each([
    [null, 3000, 10000],
    [line, NaN, 10000],
    [line, 3000, NaN],
    [line, 3000, -1],
    [line, 3000, 2000],
    [line, 1000, 10000],
    [{ ...line, words: {} }, 3000, 10000],
    [{ ...line, words: [{ start_ms: NaN }] }, 3000, 10000],
    [{ ...line, words: [{ start_ms: 1500, end_ms: 1400 }] }, 3000, 10000],
  ])('rejects malformed or invalid bounds (%j)', (value, end, duration) => {
    expect(waveformMarkerBounds(value, end, duration)).toBeNull()
  })
})

describe('neighboring lyric warnings', () => {
  it('allows exact boundaries and warns about crossings in both directions', () => {
    const previous = { start_ms: 500, end_ms: 1000 }
    expect(waveformNeighborWarnings({ startMs: 1000, endMs: 3000 }, previous, 1000, 3000)).toEqual(
      []
    )
    const warnings = waveformNeighborWarnings({ startMs: 900, endMs: 3250 }, previous, 1000, 3000)
    expect(warnings).toEqual([
      'Start passes previous lyric end by 0.100 s',
      'End passes next lyric start by 0.250 s',
    ])
    expect(previous).toEqual({ start_ms: 500, end_ms: 1000 })
  })
  it('uses the saved current start for a previous inferred end', () => {
    expect(
      waveformNeighborWarnings({ startMs: 900, endMs: 2000 }, { start_ms: 500 }, 1000, null)
    ).toEqual(['Start passes previous lyric end by 0.100 s'])
  })
  it('ignores missing/untimed neighbors and invalid known boundaries', () => {
    expect(
      waveformNeighborWarnings({ startMs: 1000, endMs: 3000 }, { start_ms: null }, 1000, null)
    ).toEqual([])
    expect(
      waveformNeighborWarnings(
        { startMs: 1000, endMs: 3000 },
        { start_ms: 500, end_ms: NaN },
        1000,
        NaN
      )
    ).toEqual([])
    expect(waveformNeighborWarnings({ startMs: NaN, endMs: 3000 }, null, 1000, 2000)).toEqual([])
  })
})
