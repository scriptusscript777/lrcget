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

// Sentence-only alignment never commits the engine's proposed word timing.
export function mergeSentenceAlignment(lines, result, { preventOverlaps = true } = {}) {
  if (
    !Array.isArray(result?.lines) ||
    !Number.isSafeInteger(result.duration_ms) ||
    result.duration_ms <= 0
  )
    throw new Error('The alignment engine returned invalid results.')
  const indices = result.lines.map(line => line?.index)
  if (
    indices.some(index => !Number.isInteger(index) || index < 0 || index >= lines.length) ||
    new Set(indices).size !== indices.length
  )
    throw new Error('The alignment engine returned invalid sentence indices.')
  const candidates = new Map(result.lines.map(line => [line.index, line]))
  const review = []
  const changed = new Set()
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
      candidate.words.some(word => !word || typeof word.text !== 'string') ||
      candidate.words.map(word => word.text).join('') !== original.text
    )
      return skip(candidate?.error || 'Aligned sentence does not match the original lyrics.')
    const start = candidate.start_ms,
      end = candidate.end_ms
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > result.duration_ms
    )
      return skip('Sentence boundaries need review.')
    if (start === original.start_ms && end === original.end_ms) return original
    const delta = start - (original.start_ms ?? start)
    const words = (original.words || []).map(word => ({
      ...word,
      ...(word.start_ms != null ? { start_ms: word.start_ms + delta } : {}),
      ...(word.end_ms != null ? { end_ms: word.end_ms + delta } : {}),
    }))
    if (
      words.some(
        (word, i) =>
          (word.start_ms != null &&
            (!Number.isSafeInteger(word.start_ms) ||
              word.start_ms < start ||
              word.start_ms >= end ||
              (i && words[i - 1].start_ms != null && word.start_ms <= words[i - 1].start_ms))) ||
          (word.end_ms != null &&
            (!Number.isSafeInteger(word.end_ms) ||
              word.start_ms == null ||
              word.end_ms <= word.start_ms ||
              word.end_ms > (words[i + 1]?.start_ms ?? end)))
      )
    )
      return skip('Existing word timing cannot fit the new sentence. Adjust it manually first.')
    // Probability is only a review hint; even high confidence requires listening.
    const uncertain = candidate.words.some(
      word => !Number.isFinite(word.confidence) || word.confidence < 0.5
    )
    if (uncertain)
      review.push({ index, reason: 'Sentence needs listening review.', skipped: false })
    changed.add(index)
    return { ...original, start_ms: start, end_ms: end, words }
  })
  // Include preserved skipped rows and blank clear cues: never silently move them.
  if (preventOverlaps) {
    // Reverting a proposal can expose a conflict with its next neighbor. Repeat
    // until stable; each pass removes at least one changed row, so it is bounded.
    let retry = true
    while (retry) {
      retry = false
      let previous = null
      for (let index = 0; index < merged.length; index++) {
        const line = merged[index]
        if (line.start_ms == null) continue
        if (
          previous != null &&
          (merged[previous].start_ms >= line.start_ms || merged[previous].end_ms > line.start_ms)
        ) {
          const conflicting = [previous, index].filter(i => changed.has(i))
          if (!conflicting.length)
            throw new Error(
              'Existing sentence timing or gap cues overlap. Correct them before applying alignment.'
            )
          for (const i of conflicting) {
            merged[i] = lines[i]
            changed.delete(i)
            const warning = review.findIndex(item => item.index === i)
            if (warning >= 0) review.splice(warning, 1)
            review.push({
              index: i,
              reason: 'Proposed timing conflicts with another sentence or gap cue.',
              skipped: true,
            })
          }
          retry = true
          break
        }
        previous = index
      }
    }
  }
  return {
    lines: merged,
    review,
    changedSentences: changed.size,
    replacedSentences: [...changed].filter(
      i => lines[i].start_ms != null || lines[i].end_ms != null
    ).length,
  }
}
