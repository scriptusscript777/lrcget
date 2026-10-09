import { LineType, parseLine } from 'lrc-kit'

export function parseImportedLyrics(content, filePath = '') {
  if (typeof content !== 'string') throw new Error('The lyrics file could not be read as text')
  const text = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
  if (!text) throw new Error('The lyrics file is empty')
  const rows = text.split('\n').map(raw => ({ raw, parsed: parseLine(raw) }))
  const timed = rows.some(
    ({ raw, parsed }) => parsed.type === LineType.TIME || /^\s*\[\s*\d+\s*:/.test(raw)
  )
  if (!timed) {
    if (/\.lrc$/i.test(filePath)) throw new Error('No valid timestamps found in the LRC file')
    return { kind: 'plain', plain: text, lines: [] }
  }

  const lines = []
  for (const { raw, parsed } of rows) {
    if (!raw.trim()) continue
    if (parsed.type === LineType.INFO) {
      if (/^\s*\[\s*\d+\s*:/.test(raw))
        throw new Error('The lyrics file contains a malformed timestamp')
      if (parsed.key.toLowerCase() === 'offset' && Number(parsed.value) !== 0)
        throw new Error('Apply the LRC offset to its timestamps before importing')
      continue
    }
    // Never silently drop malformed/mixed rows or treat word timestamps as literal lyric text.
    if (parsed.type !== LineType.TIME || /<\s*\d+\s*:/.test(parsed.content))
      throw new Error('Use line-level [mm:ss.xx] timestamps on every lyric line')
    for (const timestamp of parsed.timestamps) {
      if (
        !Number.isFinite(timestamp) ||
        timestamp < 0 ||
        !Number.isSafeInteger(Math.round(timestamp * 1000))
      )
        throw new Error('The lyrics file contains an invalid timestamp')
      lines.push({ text: parsed.content, start_ms: Math.round(timestamp * 1000), words: [] })
    }
  }
  lines.sort((a, b) => a.start_ms - b.start_ms)
  if (!lines.length || !lines.some(line => line.text.trim()))
    throw new Error('The lyrics file contains no timed lyric words')
  return {
    kind: 'synced',
    plain: lines
      .filter(line => line.text)
      .map(line => line.text)
      .join('\n'),
    lines: lines.map((line, index) => ({ ...line, end_ms: lines[index + 1]?.start_ms })),
  }
}
