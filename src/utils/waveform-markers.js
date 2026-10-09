// Start edits translate words, not neighboring lines; end edits never truncate words.
export function waveformMarkerBounds(line, endMs, durationMs) {
  if (
    !Number.isFinite(line?.start_ms) ||
    !Number.isFinite(endMs) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    line.start_ms < 0 ||
    endMs > durationMs ||
    endMs <= line.start_ms
  )
    return null
  if (line.words != null && !Array.isArray(line.words)) return null
  const words = (line.words || []).flatMap(word => {
    if (
      !word ||
      (word.start_ms != null && !Number.isFinite(word.start_ms)) ||
      (word.end_ms != null && !Number.isFinite(word.end_ms)) ||
      (Number.isFinite(word.start_ms) &&
        (word.start_ms < line.start_ms || word.start_ms >= endMs)) ||
      (Number.isFinite(word.end_ms) && (word.end_ms < line.start_ms || word.end_ms > endMs)) ||
      (Number.isFinite(word.start_ms) &&
        Number.isFinite(word.end_ms) &&
        word.end_ms < word.start_ms)
    )
      return [{ time: NaN, gap: 0 }]
    return [
      ...(Number.isFinite(word.start_ms) ? [{ time: word.start_ms, gap: 1 }] : []),
      ...(Number.isFinite(word.end_ms) ? [{ time: word.end_ms, gap: 0 }] : []),
    ]
  })
  if (words.some(word => !Number.isFinite(word.time))) return null
  const offsets = words.map(word => word.time - line.start_ms)
  const startMin = Math.max(0, ...offsets.map(offset => -offset))
  const startMax = Math.min(
    durationMs,
    endMs - 1,
    ...words.map(word => endMs - word.gap - (word.time - line.start_ms))
  )
  const endMin = Math.max(line.start_ms + 1, ...words.map(word => word.time + word.gap))
  if (startMax < startMin || endMin > durationMs) return null
  return { start: { min: startMin, max: startMax }, end: { min: endMin, max: durationMs } }
}
