import { describe, expect, it } from 'vitest'
import { editWordBoundary, selectedWordRange } from './word-loop-range.js'
const words = () => [
  { text: 'one ', start_ms: 1000, end_ms: 1400 },
  { text: 'two', start_ms: 1600, end_ms: 2000 },
]
describe('selected word audition and precision edits', () => {
  it('preserves explicit silence gaps and infers only missing ends', () => {
    expect(selectedWordRange(words(), 0, 2500)).toEqual({ startMs: 1000, endMs: 1400 })
    expect(selectedWordRange([{ start_ms: 1000 }, { start_ms: 1600 }], 0, 2500)).toEqual({
      startMs: 1000,
      endMs: 1600,
    })
    expect(selectedWordRange([{ start_ms: 1600 }], 0, 2500)).toEqual({ startMs: 1600, endMs: 2500 })
  })
  it('rejects invalid selections and reversed or absent timestamps', () => {
    for (const value of [-1, 2, 0.5, NaN])
      expect(selectedWordRange(words(), value, 2500)).toBeNull()
    expect(selectedWordRange([{ start_ms: 1000, end_ms: 900 }], 0, 2500)).toBeNull()
    expect(selectedWordRange([{ start_ms: null }], 0, 2500)).toBeNull()
  })
  it('clamps start edits against prior word ends and the current word end', () => {
    expect(editWordBoundary(words(), 1, 'start', 0, 1000, 2500)[1].start_ms).toBe(1400)
    expect(editWordBoundary(words(), 1, 'start', 3000, 1000, 2500)[1].start_ms).toBe(1999)
    expect(editWordBoundary(words(), 0, 'start', 0, 1000, 2500)[0].start_ms).toBe(1000)
  })
  it('clamps end edits to neighboring words and the sentence end', () => {
    expect(editWordBoundary(words(), 0, 'end', 3000, 1000, 2500)[0].end_ms).toBe(1600)
    expect(editWordBoundary(words(), 1, 'end', 3000, 1000, 2500)[1].end_ms).toBe(2500)
    expect(editWordBoundary(words(), 1, 'end', 100, 1000, 2500)[1].end_ms).toBe(1601)
  })
  it('preserves text and other words without mutating the input', () => {
    const original = words(),
      snapshot = JSON.stringify(original)
    const updated = editWordBoundary(original, 1, 'start', 1610.4, 1000, 2500)
    expect(updated[1].start_ms).toBe(1610)
    expect(updated[0]).toEqual(original[0])
    expect(JSON.stringify(original)).toBe(snapshot)
    expect(updated.map(w => w.text).join('')).toBe('one two')
  })
  it('rejects nonfinite input and unknown boundary actions', () => {
    expect(editWordBoundary(words(), 1, 'end', NaN, 1000, 2500)).toBeNull()
    expect(editWordBoundary(words(), 1, 'unknown', 1800, 1000, 2500)).toBeNull()
  })
})
