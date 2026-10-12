import { describe, expect, it, vi } from 'vitest'
import { prepareEstimatedWordExport } from './estimated-word-export.js'

const options = () => ({
  durationMs: 10000,
  preventOverlaps: true,
  segment: vi.fn(async text => text.match(/\S+\s*/g)),
})
describe('estimated ELRC preparation', () => {
  it('fills untimed sentences while preserving all saved adjustments and the source', async () => {
    const edited = {
      text: 'One two',
      start_ms: 1000,
      end_ms: 3000,
      words: [
        { text: 'One ', start_ms: 1234, end_ms: 1700 },
        { text: 'two', start_ms: 1800, end_ms: 2700 },
      ],
    }
    const source = [edited, { text: 'Three four', start_ms: 3000, end_ms: 5000, words: [] }]
    const original = JSON.stringify(source)
    const plan = await prepareEstimatedWordExport(source, options())
    expect(plan.estimatedSentences).toBe(1)
    expect(plan.lines[0]).toEqual(edited)
    expect(plan.lines[1].words).toEqual([
      { text: 'Three ', start_ms: 3000 },
      { text: 'four', start_ms: 4000 },
    ])
    expect(JSON.stringify(source)).toBe(original)
  })
  it('fills only missing starts around existing starts and explicit gap ends', async () => {
    const plan = await prepareEstimatedWordExport(
      [
        {
          text: 'a b c d',
          start_ms: 0,
          end_ms: 4000,
          words: [
            { text: 'a ', start_ms: 100, end_ms: 700 },
            { text: 'b ' },
            { text: 'c ', start_ms: 2000 },
            { text: 'd' },
          ],
        },
      ],
      options()
    )
    expect(plan.lines[0].words).toEqual([
      { text: 'a ', start_ms: 100, end_ms: 700 },
      { text: 'b ', start_ms: 700 },
      { text: 'c ', start_ms: 2000 },
      { text: 'd', start_ms: 3000 },
    ])
  })
  it('uses next sentence or audio end for missing sentence ends, retaining blank gap lines', async () => {
    const plan = await prepareEstimatedWordExport(
      [
        { text: 'one two', start_ms: 1000 },
        { text: '', start_ms: 4000 },
        { text: 'last word', start_ms: 6000 },
      ],
      options()
    )
    expect(plan.lines[0].end_ms).toBe(4000)
    expect(plan.lines[1]).toEqual({ text: '', start_ms: 4000 })
    expect(plan.lines[2].end_ms).toBe(10000)
  })
  it.each([
    { text: 'untimed sentence' },
    { text: 'short sentence', start_ms: 0, end_ms: 1 },
    { text: 'invalid', start_ms: 0, end_ms: 500, words: [{ text: 'invalid', start_ms: -1 }] },
    {
      text: 'a b',
      start_ms: 0,
      end_ms: 500,
      words: [
        { text: 'a ', start_ms: 100, end_ms: 400 },
        { text: 'b', start_ms: 200 },
      ],
    },
    { text: 'a b', start_ms: 0, end_ms: 500, words: [{ text: 'different', start_ms: 0 }] },
    { text: '<00:01.000>bad', start_ms: 0, end_ms: 500 },
  ])('rejects invalid timing/text without replacing saved adjustments: %j', async line => {
    const before = JSON.stringify(line)
    await expect(prepareEstimatedWordExport([line], options())).rejects.toThrow('Sentence 1:')
    expect(JSON.stringify(line)).toBe(before)
  })
  it('honors overlap protection without clipping manual timing', async () => {
    const lines = [
      { text: 'one', start_ms: 0, end_ms: 2000 },
      { text: 'two', start_ms: 1000, end_ms: 3000 },
    ]
    await expect(prepareEstimatedWordExport(lines, options())).rejects.toThrow('overlaps')
    const plan = await prepareEstimatedWordExport(lines, { ...options(), preventOverlaps: false })
    expect(plan.lines[0].end_ms).toBe(2000)
  })
  it('does not segment or request estimates for already complete word timing', async () => {
    const settings = options()
    const line = {
      text: 'hello',
      start_ms: 0,
      end_ms: 1000,
      words: [{ text: 'hello', start_ms: 0 }],
    }
    expect((await prepareEstimatedWordExport([line], settings)).estimatedSentences).toBe(0)
    expect(settings.segment).not.toHaveBeenCalled()
  })
})
