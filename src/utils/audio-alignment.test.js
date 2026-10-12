import { describe, expect, it } from 'vitest'
import { mergeAudioAlignment, mergeSentenceAlignment } from './audio-alignment.js'
const lines = () => [{ text: 'hello world', start_ms: 1000, end_ms: 3000, words: [] }]
const result = () => ({
  duration_ms: 5000,
  lines: [
    {
      index: 0,
      start_ms: 1000,
      end_ms: 3000,
      words: [
        { text: 'hello ', start_ms: 1100, end_ms: 1800, confidence: 0.9 },
        { text: 'world', start_ms: 2000, end_ms: 2800, confidence: 0.4 },
      ],
    },
  ],
})

describe('sentence-only audio alignment', () => {
  it('rechecks neighbors when reverting a conflicting proposal', () => {
    const input = [0, 1, 2].map(i => ({
      text: 'hello world',
      start_ms: 1000 + i * 1000,
      end_ms: 2000 + i * 1000,
      words: [],
    }))
    const output = result()
    output.lines[0].end_ms = 2300
    output.lines.push({ ...output.lines[0], index: 1, start_ms: 2400, end_ms: 3100 })
    const plan = mergeSentenceAlignment(input, output)
    expect(plan.lines).toEqual(input)
    expect(plan.changedSentences).toBe(0)
    expect(plan.review.filter(item => item.skipped)).toHaveLength(3)
  })
  it('requires correcting conflicting original ranges when no proposal can resolve them', () => {
    const input = [...lines(), { text: 'next', start_ms: 2500, end_ms: 4000, words: [] }]
    expect(() => mergeSentenceAlignment(input, result())).toThrow(/Existing sentence timing/)
  })

  it('replaces LRC ranges, preserves lyrics, and does not commit proposed words', () => {
    const input = lines(),
      output = result()
    output.lines[0].start_ms = 1100
    const before = JSON.stringify({ input, output })
    const plan = mergeSentenceAlignment(input, output)
    expect(plan.lines[0]).toEqual({ ...input[0], start_ms: 1100 })
    expect(plan.changedSentences).toBe(1)
    expect(plan.replacedSentences).toBe(1)
    expect(JSON.stringify({ input, output })).toBe(before)
  })
  it('assigns untimed TXT ranges without a replacement confirmation count', () => {
    const plan = mergeSentenceAlignment([{ text: 'hello world', words: [] }], result())
    expect(plan.lines[0].start_ms).toBe(1000)
    expect(plan.lines[0].words).toEqual([])
    expect(plan.replacedSentences).toBe(0)
  })
  it('shifts existing ELRC words with the sentence while preserving relative durations', () => {
    const input = lines(),
      output = result()
    input[0].words = [
      { text: 'hello ', start_ms: 1100, end_ms: 1800 },
      { text: 'world', start_ms: 2000, end_ms: 2800 },
    ]
    output.lines[0].start_ms = 1500
    output.lines[0].end_ms = 3500
    const plan = mergeSentenceAlignment(input, output)
    expect(plan.lines[0].words[0]).toEqual({ text: 'hello ', start_ms: 1600, end_ms: 2300 })
    expect(plan.lines[0].words[1].end_ms).toBe(3300)
  })
  it('keeps a sentence whose saved words cannot fit a shortened range', () => {
    const input = lines(),
      output = result()
    input[0].words = [{ text: 'hello world', start_ms: 1100, end_ms: 2900 }]
    output.lines[0].end_ms = 1500
    const plan = mergeSentenceAlignment(input, output)
    expect(plan.lines[0]).toEqual(input[0])
    expect(plan.changedSentences).toBe(0)
    expect(plan.review[0].skipped).toBe(true)
  })
  it('is a no-op for an unchanged range', () => {
    expect(mergeSentenceAlignment(lines(), result()).changedSentences).toBe(0)
  })
  it.each(['missing', 'text', 'negative', 'zero', 'duration'])(
    'preserves original work on %s output',
    kind => {
      const output = result()
      if (kind === 'missing') output.lines = []
      if (kind === 'text') output.lines[0].words[0].text = 'different '
      if (kind === 'negative') output.lines[0].start_ms = -1
      if (kind === 'zero') output.lines[0].end_ms = 1000
      if (kind === 'duration') output.lines[0].end_ms = 6000
      const plan = mergeSentenceAlignment(lines(), output)
      expect(plan.lines).toEqual(lines())
      expect(plan.review[0].skipped).toBe(true)
    }
  )
  it('rejects duplicate indices and malformed results', () => {
    const output = result()
    output.lines.push({ ...output.lines[0] })
    expect(() => mergeSentenceAlignment(lines(), output)).toThrow(/indices/)
    expect(() => mergeSentenceAlignment(lines(), { lines: [], duration_ms: NaN })).toThrow(
      /invalid results/
    )
  })
  it('protects preserved blank gap cues, unless protection is explicitly off', () => {
    const input = [
      { ...lines()[0], end_ms: 2000 },
      { text: '', start_ms: 2500, words: [] },
    ]
    expect(mergeSentenceAlignment(input, result()).review[0].reason).toMatch(/gap cue/)
    expect(mergeSentenceAlignment(input, result(), { preventOverlaps: false }).lines[1]).toEqual(
      input[1]
    )
  })
  it('skips a new range overlapping a skipped original row', () => {
    const input = [...lines(), { text: 'next', start_ms: 3200, end_ms: 4000, words: [] }]
    const output = result()
    output.lines[0].end_ms = 3500
    expect(mergeSentenceAlignment(input, output).lines).toEqual(input)
  })
})
describe('optional audio alignment merging', () => {
  it('rejects duplicate or invalid sentence indices', () => {
    const output = result()
    output.lines.push({ ...output.lines[0] })
    expect(() => mergeAudioAlignment(lines(), output)).toThrow(/indices/)
    output.lines[1].index = 2
    expect(() => mergeAudioAlignment(lines(), output)).toThrow(/indices/)
  })
  it('never combines incompatible saved and proposed token boundaries', () => {
    const input = lines()
    input[0].words = [{ text: 'hel', start_ms: 1000, end_ms: 1500 }, { text: 'lo world' }]
    const plan = mergeAudioAlignment(input, result())
    expect(plan.lines[0]).toEqual(input[0])
    expect(plan.changedWords).toBe(0)
  })

  it('keeps original lyrics and sentence bounds, marking uncertainty without mutation', () => {
    const input = lines(),
      output = result(),
      original = JSON.stringify({ input, output })
    const plan = mergeAudioAlignment(input, output)
    expect(plan.lines[0].text).toBe('hello world')
    expect(plan.lines[0].start_ms).toBe(1000)
    expect(plan.changedWords).toBe(2)
    expect(plan.review).toHaveLength(1)
    expect(JSON.stringify({ input, output })).toBe(original)
  })
  it('preserves existing manual words while filling remaining words', () => {
    const input = lines()
    input[0].words = [{ text: 'hello ', start_ms: 1000, end_ms: 1650 }, { text: 'world' }]
    const plan = mergeAudioAlignment(input, result())
    expect(plan.lines[0].words[0]).toEqual(input[0].words[0])
    expect(plan.lines[0].words[1].start_ms).toBe(2000)
  })
  it('changes saved timing only with an explicit replace choice', () => {
    const input = lines()
    input[0].words = result().lines[0].words.map(word => ({
      text: word.text,
      start_ms: word.start_ms + 10,
      end_ms: word.end_ms,
    }))
    expect(mergeAudioAlignment(input, result()).changedWords).toBe(0)
    expect(mergeAudioAlignment(input, result(), { replace: true }).changedWords).toBe(2)
  })
  it.each(['text', 'cross', 'zero', 'duration', 'missing'])(
    'skips invalid %s results and keeps original work',
    kind => {
      const input = lines(),
        output = result()
      if (kind === 'text') output.lines[0].words[0].text = 'wrong '
      if (kind === 'cross') output.lines[0].words[0].end_ms = 2200
      if (kind === 'zero') output.lines[0].words[0].end_ms = 1100
      if (kind === 'duration') output.duration_ms = 2000
      if (kind === 'missing') output.lines = []
      const plan = mergeAudioAlignment(input, output)
      expect(plan.lines[0]).toEqual(input[0])
      expect(plan.review[0].skipped).toBe(true)
    }
  )
  it('assigns TXT boundaries without changing text', () => {
    const input = [{ text: 'hello world', words: [] }]
    expect(mergeAudioAlignment(input, result()).lines[0].start_ms).toBe(1000)
  })
  it('rejects protected sentence overlaps', () => {
    const input = [...lines(), { text: 'next', start_ms: 2500, end_ms: 4000, words: [] }]
    expect(() => mergeAudioAlignment(input, result())).toThrow(/overlapping sentences/)
  })
  it('does not apply AI timing that conflicts with a preserved anchor', () => {
    const input = lines()
    input[0].words = [{ text: 'hello ', start_ms: 1000, end_ms: 2400 }, { text: 'world' }]
    expect(mergeAudioAlignment(input, result()).changedWords).toBe(0)
  })
})
