import { describe, expect, it } from 'vitest'
import { linesToLrc, parseLrcLines, parseLyricsfile, serializeLyricsfile } from './lyricsfile.js'

describe('standard LRC gap export', () => {
  const first = { text: 'First phrase', start_ms: 1000, end_ms: 2000 }
  const last = { text: 'Last phrase', start_ms: 3000, end_ms: 4000 }
  it('exports confirmed silence and the final end without modifying the document', () => {
    const lines = [first, last]
    const original = JSON.stringify(lines)
    const output = linesToLrc(lines)
    expect(output).toBe('[00:01.000]First phrase\n[00:02.000]\n[00:03.000]Last phrase\n[00:04.000]')
    expect(parseLrcLines(output).map(line => [line.start_ms, line.text])).toEqual([
      [1000, 'First phrase'],
      [2000, ''],
      [3000, 'Last phrase'],
      [4000, ''],
    ])
    expect(JSON.stringify(lines)).toBe(original)
  })
  it.each([2000, 2001, 2100, 2249])(
    'avoids duplicate or flickering clear cues before start %s',
    start => {
      expect(linesToLrc([first, { ...last, start_ms: start }])).not.toContain('[00:02.000]\n')
    }
  )
  it('preserves a gap of exactly 250 ms', () => {
    expect(linesToLrc([first, { ...last, start_ms: 2250 }])).toContain('[00:02.000]\n')
  })
  it('preserves existing blank cues and never duplicates their timestamp', () => {
    const result = linesToLrc([first, { text: '', start_ms: 2000 }, last])
    expect(result.match(/\[00:02.000\]/g)).toHaveLength(1)
  })
  it('does not clear lyrics while another overlapping phrase is active', () => {
    expect(linesToLrc([first, { ...last, start_ms: 1500 }])).not.toContain('[00:02.000]')
  })
  it('keeps untimed text in saved data without exporting invented timestamps', () => {
    const untimed = { text: 'not timed yet' }
    const saved = serializeLyricsfile({
      track: {},
      syncedLines: [first, untimed],
      plainLyrics: 'First phrase\nnot timed yet',
    })
    const parsed = parseLyricsfile(saved)
    expect(parsed.syncedLines[1]).toMatchObject(untimed)
    expect(parsed.syncedLyrics).not.toContain('not timed yet')
    expect(parsed.plainLyrics).toContain('not timed yet')
    expect(linesToLrc([untimed])).toBe('')
  })
  it('sorts cues chronologically and retains exact milliseconds', () => {
    expect(
      linesToLrc([
        { ...last, start_ms: 3001 },
        { ...first, end_ms: 2001 },
      ])
    ).toContain('[00:02.001]\n[00:03.001]')
  })
})
