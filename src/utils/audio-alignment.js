// Preserve lyrics/anchors; uncertain or invalid sentences are never silently repaired.
export function mergeAudioAlignment(
  lines,
  result,
  { replace = false, preventOverlaps = true } = {}
) {
  if (!Array.isArray(result?.lines) || !Number.isFinite(result.duration_ms))
    throw new Error('The alignment engine returned invalid results.')
  const indices = result.lines.map(line => line?.index)
  if (
    indices.some(index => !Number.isInteger(index) || index < 0 || index >= lines.length) ||
    new Set(indices).size !== indices.length
  )
    throw new Error('The alignment engine returned invalid sentence indices.')
  const candidates = new Map(result.lines.map(line => [line.index, line]))
  const review = []
  let changedWords = 0
  const merged = lines.map((original, index) => {
    if (!original.text.trim()) return original
    const candidate = candidates.get(index)
    const skip = reason => {
      review.push({ index, reason, skipped: true })
      return original
    }
    if (
      !Array.isArray(candidate?.words) ||
      !candidate.words.length ||
      candidate.words.some(word => !word || typeof word.text !== 'string')
    )
      return skip(candidate?.error || 'No aligned words returned.')
    if (candidate.words.map(word => word.text).join('') !== original.text)
      return skip('Aligned words do not match the original text.')
    const existing = original.words || []
    if (!replace && existing.length && existing.map(word => word.text).join('') !== original.text)
      return skip('Existing word text needs review.')
    const start = original.start_ms ?? candidate.start_ms
    const end =
      original.end_ms ??
      (original.start_ms != null
        ? lines.slice(index + 1).find(line => Number.isFinite(line.start_ms))?.start_ms
        : null) ??
      candidate.end_ms
    const words = candidate.words.map((word, wordIndex) => {
      const saved = existing[wordIndex]
      return !replace && Number.isFinite(saved?.start_ms)
        ? { ...saved }
        : { text: word.text, start_ms: word.start_ms, end_ms: word.end_ms }
    })
    if (words.map(word => word.text).join('') !== original.text)
      return skip('Preserved word tokens do not match the proposed alignment.')
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > result.duration_ms
    )
      return skip('Sentence boundaries need review.')
    const next = lines.slice(index + 1).find(line => Number.isFinite(line.start_ms))?.start_ms
    if (preventOverlaps && next != null && end > next)
      return skip('Sentence overlaps the next sentence.')
    if (
      words.some(
        (word, i) =>
          !Number.isSafeInteger(word.start_ms) ||
          word.start_ms < start ||
          word.start_ms >= end ||
          (i && word.start_ms <= words[i - 1].start_ms) ||
          (word.end_ms != null &&
            (!Number.isSafeInteger(word.end_ms) ||
              word.end_ms <= word.start_ms ||
              word.end_ms > (words[i + 1]?.start_ms ?? end)))
      )
    )
      return skip('Aligned words conflict with sentence bounds or preserved word timing.')
    const uncertainWords = candidate.words
      .map((word, i) => ({ word, i }))
      .filter(
        ({ word, i }) =>
          (replace || !Number.isFinite(existing[i]?.start_ms)) &&
          (!Number.isFinite(word.confidence) || word.confidence < 0.5)
      )
      .map(({ i }) => i)
    const uncertain = uncertainWords.length
    if (uncertain)
      review.push({
        index,
        reason: `${uncertain} word${uncertain === 1 ? '' : 's'} ${uncertain === 1 ? 'needs' : 'need'} listening review.`,
        skipped: false,
        words: uncertainWords,
      })
    changedWords += words.filter(
      (word, i) => JSON.stringify(word) !== JSON.stringify(existing[i])
    ).length
    return { ...original, start_ms: start, end_ms: end, words }
  })
  // TXT alignment must also respect bounds of newly aligned following rows.
  if (preventOverlaps) {
    for (let i = 0; i < merged.length; i++) {
      const next = merged.slice(i + 1).find(line => Number.isFinite(line.start_ms))
      if (next && merged[i].end_ms > next.start_ms)
        throw new Error(
          'Audio alignment returned overlapping sentences. Review sentence timing first.'
        )
    }
  }
  return { lines: merged, review, changedWords }
}
