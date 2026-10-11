import { LineType, parseLine } from 'lrc-kit'

// Import absolute inline timestamps, including empty end tags written by this app.
// Never estimate word timing from plain text or duplicate absolute word tags.
export function parseEnhancedLrc(text) {
  const lines = []
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue
    const parsed = parseLine(raw)
    if (parsed.type === LineType.INFO) {
      if (/^\s*\[\s*\d+\s*:/.test(raw)) throw new Error('Malformed ELRC line timestamp')
      if (parsed.key.toLowerCase() === 'offset' && Number(parsed.value) !== 0)
        throw new Error('Apply the ELRC offset to its timestamps before importing')
      continue
    }
    if (parsed.type !== LineType.TIME) {
      if (/^\s*\[\s*\d+\s*:|<\s*\d+\s*:/.test(raw)) throw new Error('Malformed ELRC timestamp')
      lines.push({ text: raw, words: [] })
      continue
    }
    const lineTags = [...raw.matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)]
    if (lineTags.length !== parsed.timestamps.length || lineTags.some(tag => Number(tag[2]) >= 60))
      throw new Error('Invalid ELRC line timestamp')
    const tags = [...parsed.content.matchAll(/<(\d+):(\d{1,2})(?:[.:](\d{1,3}))?>/g)]
    if (/<\s*\d+\s*:/.test(parsed.content.replace(/<(\d+):(\d{1,2})(?:[.:](\d{1,3}))?>/g, '')))
      throw new Error('Malformed ELRC word timestamp')
    if (tags.length && parsed.timestamps.length !== 1)
      throw new Error('Use one line timestamp per word-timed ELRC row')
    for (const timestamp of parsed.timestamps) {
      const start = Math.round(timestamp * 1000)
      if (!Number.isSafeInteger(start) || start < 0) throw new Error('Invalid ELRC line time')
      if (!tags.length) {
        lines.push({ text: parsed.content, start_ms: start, words: [] })
        continue
      }
      const prefix = parsed.content.slice(0, tags[0].index)
      if (prefix.trim()) throw new Error('Every ELRC word needs an inline start timestamp')
      const times = tags.map(tag => {
        const time =
          Number(tag[1]) * 60000 + Number(tag[2]) * 1000 + Number((tag[3] || '').padEnd(3, '0'))
        if (Number(tag[2]) >= 60 || !Number.isSafeInteger(time) || time < start)
          throw new Error('Invalid ELRC word time')
        return time
      })
      if (times.some((time, index) => index > 0 && time < times[index - 1]))
        throw new Error('ELRC word timestamps must stay in order')
      const words = []
      for (let index = 0; index < tags.length; index++) {
        let wordText = parsed.content.slice(
          tags[index].index + tags[index][0].length,
          tags[index + 1]?.index
        )
        if (!wordText) continue
        if (!words.length) wordText = prefix + wordText
        const end = times[index + 1]
        if (
          (words.length && times[index] <= words.at(-1).start_ms) ||
          (end !== undefined && end <= times[index])
        )
          throw new Error('ELRC words need positive, ordered time ranges')
        words.push({
          text: wordText,
          start_ms: times[index],
          ...(end === undefined ? {} : { end_ms: end }),
        })
      }
      if (!words.length || !words.some(word => word.text.trim()))
        throw new Error('The ELRC row contains no word text')
      lines.push({
        text: words.map(word => word.text).join(''),
        start_ms: start,
        end_ms: words.at(-1).end_ms,
        words,
      })
    }
  }
  if (!lines.some(line => Number.isFinite(line.start_ms) && line.text.trim()))
    throw new Error('The ELRC file contains no timed lyric words')
  // Keep untimed rows in document order; do not silently move or invent their timing.
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!Number.isFinite(line.start_ms)) continue
    const next = lines.slice(index + 1).find(candidate => Number.isFinite(candidate.start_ms))
    if (next && next.start_ms < line.start_ms)
      throw new Error('ELRC lyric rows must stay in chronological order')
    line.end_ms ??= next?.start_ms
    if (
      line.words.length &&
      Number.isFinite(line.end_ms) &&
      line.words.some(word => word.start_ms >= line.end_ms || word.end_ms > line.end_ms)
    )
      throw new Error('ELRC word timing extends past its sentence end')
    const lastWord = line.words.at(-1)
    if (lastWord && lastWord.end_ms === undefined && line.end_ms > lastWord.start_ms)
      lastWord.end_ms = line.end_ms
  }
  return {
    kind: 'synced',
    format: 'elrc',
    plain: lines
      .filter(line => line.text)
      .map(line => line.text)
      .join('\n'),
    lines,
  }
}
