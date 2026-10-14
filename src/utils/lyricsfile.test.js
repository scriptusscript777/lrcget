import { describe, expect, it } from 'vitest'
import {
  hasPlayableTimedLyrics,
  libraryLyricsStatus,
  linesToLrc,
  parseLrcLines,
  parseLyricsfile,
  serializeLyricsfile,
} from './lyricsfile.js'
import { parseImportedLyrics } from './lyrics-import.js'

describe('library synced status', () => {
  it.each([
    ['user.elrc', '[00:01.000]<00:01.000>hello <00:02.000>world<00:03.000>', 'synced'],
    ['server.elrc', '[00:01.000]<00:01.000>downloaded<00:03.000>', 'synced'],
    ['song.lrc', '[00:01.000]sentence timing', 'synced'],
    ['song.txt', 'untimed text', 'plain'],
  ])('shows correct status for %s', (file, content, status) => {
    const parsed = parseImportedLyrics(content, file)
    const lyricsfile = serializeLyricsfile({
      track: { title: 'test', duration: 10 },
      plainLyrics: parsed.plain,
      syncedLines: parsed.lines,
    })
    expect(libraryLyricsStatus({ lyricsfile })).toBe(status)
  })
  it('keeps unsynced sentence editing rows Plain until they have real timestamps', () => {
    const lyricsfile = serializeLyricsfile({
      track: { title: 'test', duration: 10 },
      plainLyrics: '',
      syncedLines: [{ text: 'not timed', words: [] }],
    })
    expect(libraryLyricsStatus({ lyricsfile })).toBe('plain')
    expect(libraryLyricsStatus(null)).toBeNull()
    expect(libraryLyricsStatus({ instrumental: true })).toBe('instrumental')
  })
})

describe('karaoke lyrics availability', () => {
  it.each([
    ['regular LRC sentence timing', '[00:01.000]Hello there', true],
    ['ELRC word timing', '[00:01.000]<00:01.000>Hello <00:01.500>there', true],
    ['untimed text', 'Hello there', false],
  ])('recognizes %s', (_description, content, expected) => {
    const parsed = parseImportedLyrics(content, expected ? 'song.lrc' : 'song.txt')
    const lyricsfile = serializeLyricsfile({
      track: { title: 'test', duration: 10 },
      plainLyrics: parsed.plain,
      syncedLines: parsed.lines,
    })
    expect(hasPlayableTimedLyrics({ lyricsfile })).toBe(expected)
  })

  it('does not enable karaoke for a blank timestamp cue', () => {
    const lyricsfile = serializeLyricsfile({
      track: { title: 'test', duration: 10 },
      syncedLines: [{ text: '', start_ms: 1000, words: [] }],
    })
    expect(hasPlayableTimedLyrics({ lyricsfile })).toBe(false)
  })

  it('does not enable karaoke for instrumental tracks', () => {
    expect(hasPlayableTimedLyrics({ instrumental: true, lyricsfile: '' })).toBe(false)
  })
})

describe('standard LRC gap export', () => {
  const first = { text: 'First phrase', start_ms: 1000, end_ms: 2000 }
  const last = { text: 'Last phrase', start_ms: 3000, end_ms: 4000 }
  it('parses one-digit LRC fractions for karaoke line timing', () => {
    expect(
      parseLrcLines('[1:02.5]One digit\n[01:03.25]Two digits').map(line => line.start_ms)
    ).toEqual([62500, 63250])
  })
  it('expands multiple leading timestamps into separate sorted karaoke cues', () => {
    expect(
      parseLrcLines('[00:05.00][00:02.50]Repeated line\n[00:03.00]Next line').map(line => [
        line.start_ms,
        line.text,
      ])
    ).toEqual([
      [2500, 'Repeated line'],
      [3000, 'Next line'],
      [5000, 'Repeated line'],
    ])
  })
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
