// Word-loop ranges are independent of timeline zoom and viewport geometry.
export function selectedWordRange(words, index, lineEndMs) {
  const word = words[index]
  if (!word || !Number.isInteger(index) || index < 0) return null
  const startMs = word.start_ms
  const inferredEnd = words[index + 1]?.start_ms ?? lineEndMs
  const endMs = Math.min(
    Number.isFinite(word.end_ms) ? word.end_ms : inferredEnd,
    Number.isFinite(inferredEnd) ? inferredEnd : Infinity,
    lineEndMs
  )
  return Number.isFinite(startMs) && startMs >= 0 && Number.isFinite(endMs) && endMs > startMs
    ? { startMs, endMs }
    : null
}

export function editWordBoundary(words, index, boundary, timeMs, lineStartMs, lineEndMs) {
  const range = selectedWordRange(words, index, lineEndMs)
  if (
    !range ||
    !Number.isFinite(timeMs) ||
    !Number.isFinite(lineStartMs) ||
    (boundary !== 'start' && boundary !== 'end')
  )
    return null
  const previous = words[index - 1]
  const lower = Math.max(
    lineStartMs,
    previous
      ? Math.max(previous.start_ms + 1, Number.isFinite(previous.end_ms) ? previous.end_ms : 0)
      : lineStartMs
  )
  const upper = Math.min(words[index + 1]?.start_ms ?? lineEndMs, lineEndMs)
  const min = boundary === 'start' ? lower : range.startMs + 1
  const max = boundary === 'start' ? range.endMs - 1 : upper
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null
  const value = Math.max(min, Math.min(max, Math.round(timeMs)))
  return words.map((word, position) =>
    position === index
      ? { ...word, [boundary === 'start' ? 'start_ms' : 'end_ms']: value }
      : { ...word }
  )
}
