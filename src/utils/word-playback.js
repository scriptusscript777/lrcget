// Shared editor playback rules: all intervals include the start and exclude the end.
export function linePlaybackBounds(line, { previewRange, inferredEndMs } = {}) {
  return {
    startMs: previewRange?.startMs ?? line?.start_ms,
    endMs: previewRange?.endMs ?? line?.end_ms ?? inferredEndMs,
  }
}

export function isLinePlaybackActive(line, progressMs, options) {
  const { startMs, endMs } = linePlaybackBounds(line, options)
  return (
    Number.isFinite(progressMs) &&
    Number.isFinite(startMs) &&
    startMs >= 0 &&
    progressMs >= startMs &&
    (!Number.isFinite(endMs) || progressMs < endMs)
  )
}

export function activeWordIndex(line, progressMs, options) {
  if (!isLinePlaybackActive(line, progressMs, options) || !Array.isArray(line?.words)) return -1
  // Scan backwards once: keep the latest timed word until the next start.
  // Missing word starts do not replace already edited timing with an estimate.
  for (let index = line.words.length - 1; index >= 0; index--) {
    const startMs = line.words[index]?.start_ms
    if (Number.isFinite(startMs) && startMs >= 0 && progressMs >= startMs) return index
  }
  return -1
}
