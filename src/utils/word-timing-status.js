// A server flag alone is not enough: inspect the word data the editor will use.
export function hasMeasuredWordTiming(line) {
  if (
    !Number.isSafeInteger(line?.start_ms) ||
    line.start_ms < 0 ||
    (line.end_ms != null && (!Number.isSafeInteger(line.end_ms) || line.end_ms <= line.start_ms)) ||
    !Array.isArray(line.words) ||
    !line.words.length
  )
    return false
  const text = line.words.map(word => word?.text ?? '').join('')
  if (!text.trim() || typeof line.text !== 'string' || text !== line.text) return false
  return line.words.every((word, index) => {
    const next = line.words[index + 1]?.start_ms
    const start = word?.start_ms
    const end = word?.end_ms
    return (
      typeof word?.text === 'string' &&
      Number.isSafeInteger(start) &&
      start >= line.start_ms &&
      (index === 0 || start > line.words[index - 1].start_ms) &&
      (!Number.isFinite(line.end_ms) || start < line.end_ms) &&
      (end == null ||
        (Number.isSafeInteger(end) &&
          end > start &&
          (!Number.isFinite(next) || end <= next) &&
          (!Number.isFinite(line.end_ms) || end <= line.end_ms)))
    )
  })
}
