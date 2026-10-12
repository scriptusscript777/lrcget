// Prepare a complete ELRC document without mutating the editor or its saved timings.
export async function prepareEstimatedWordExport(lines, { durationMs, preventOverlaps, segment }) {
  if (!lines.some(line => line.text?.trim()))
    throw new Error('Add sentence timing before saving word-timed lyrics.')
  let estimatedSentences = 0
  const result = []
  for (const [index, line] of lines.entries()) {
    const fail = reason => {
      throw new Error(`Sentence ${index + 1}: ${reason}`)
    }
    if (!line.text?.trim()) {
      result.push(line)
      continue
    }
    const start = line.start_ms
    const next = lines.slice(index + 1).find(other => Number.isFinite(other.start_ms))?.start_ms
    const end = line.end_ms ?? next ?? durationMs
    if (!Number.isInteger(start) || start < 0 || !Number.isInteger(end) || end <= start)
      fail('set sentence start and end timing before saving word-timed lyrics.')
    if (Number.isFinite(durationMs) && end > durationMs)
      fail('sentence timing exceeds the audio duration.')
    if (preventOverlaps && Number.isFinite(next) && end > next)
      fail('sentence timing overlaps the next sentence. Adjust its markers first.')
    if (
      line.text.includes('\n') ||
      line.text.includes('\r') ||
      /<\d+:\d+(?:[.:]\d+)?>/.test(line.text)
    )
      fail('text contains a reserved ELRC timestamp or line break.')
    let words = line.words || []
    if (!Array.isArray(words) || words.some(word => !word || typeof word.text !== 'string'))
      fail('invalid saved word data; review word timing first.')
    if (words.length && words.map(word => word.text).join('') !== line.text)
      fail('saved words do not match the sentence; review word timing first.')
    if (!words.length) {
      const tokens = await segment(line.text)
      if (!Array.isArray(tokens) || !tokens.length || tokens.join('') !== line.text)
        fail('could not estimate words without changing the lyric text.')
      words = tokens.map(text => ({ text }))
    }
    const needsEstimates = words.some(word => word.start_ms == null)
    words = words.map(word => ({ ...word }))
    // Fill missing starts between saved anchors; explicit starts/ends remain untouched.
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      if (words[wordIndex].start_ms != null) continue
      const first = wordIndex
      let stop = first
      while (stop < words.length && words[stop].start_ms == null) stop++
      const previous = words[first - 1]
      const low = previous ? (previous.end_ms ?? previous.start_ms) : start
      const high = words[stop]?.start_ms ?? end
      const count = stop - first
      const leavePreviousWord = previous && previous.end_ms == null ? 1 : 0
      if (
        !Number.isInteger(low) ||
        !Number.isInteger(high) ||
        high - low < count + leavePreviousWord
      )
        fail('not enough room between saved word times for estimates.')
      for (let offset = 0; offset < count; offset++)
        words[first + offset].start_ms = Math.round(
          low + ((offset + leavePreviousWord) * (high - low)) / (count + leavePreviousWord)
        )
      wordIndex = stop - 1
    }
    for (const [wordIndex, word] of words.entries()) {
      const following = words[wordIndex + 1]?.start_ms ?? end
      if (
        !Number.isInteger(word.start_ms) ||
        word.start_ms < start ||
        word.start_ms >= following ||
        word.start_ms >= end
      )
        fail('saved word starts are outside the sentence or overlap.')
      if (
        word.end_ms != null &&
        (!Number.isInteger(word.end_ms) || word.end_ms <= word.start_ms || word.end_ms > following)
      )
        fail('saved word ends are outside the sentence or overlap.')
    }
    if (needsEstimates) estimatedSentences++
    result.push({ ...line, end_ms: end, words })
  }
  return { lines: result, estimatedSentences }
}
