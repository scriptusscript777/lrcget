const positive = value => (Number.isFinite(value) && value > 0 ? value : 0)

export function clampTime(value, duration) {
  return Math.min(positive(duration), Math.max(0, Number.isFinite(value) ? value : 0))
}

export function normalizeViewport(duration, start = 0, span = duration) {
  const total = positive(duration)
  if (!total) return { start: 0, span: 0 }
  const boundedSpan = Math.min(total, positive(span) || total)
  return { start: clampTime(start, total - boundedSpan), span: boundedSpan }
}

export function zoomViewport(duration, viewport, factor, playhead = null, minimumSpan = 1) {
  const current = normalizeViewport(duration, viewport.start, viewport.span)
  if (!current.span || !positive(factor)) return current
  const visible =
    Number.isFinite(playhead) &&
    playhead >= current.start &&
    playhead <= current.start + current.span
  const anchor = visible ? playhead : current.start + current.span / 2
  const ratio = (anchor - current.start) / current.span
  const span = Math.min(
    duration,
    Math.max(Math.min(duration, positive(minimumSpan) || 1), current.span * factor)
  )
  return normalizeViewport(duration, anchor - ratio * span, span)
}

export function timeToPixel(time, viewport, width) {
  if (!positive(width) || !positive(viewport.span) || !Number.isFinite(time)) return 0
  return ((time - viewport.start) / viewport.span) * width
}

export function pixelToTime(pixel, viewport, width, duration) {
  if (!positive(width) || !positive(viewport.span)) return clampTime(viewport.start, duration)
  const x = clampTime(pixel, width)
  return clampTime(viewport.start + (x / width) * viewport.span, duration)
}

export function aggregatePeaks(peaks, secondsPerPeak, viewport, width) {
  const columns = Math.floor(positive(width))
  const result = new Float32Array(columns)
  if (!columns || !positive(secondsPerPeak) || !positive(viewport.span) || !peaks.length)
    return result
  // Include every peak touched by a pixel bin: short transients survive zoom-out.
  for (let x = 0; x < columns; x++) {
    const from = Math.max(
      0,
      Math.floor((viewport.start + (x / columns) * viewport.span) / secondsPerPeak)
    )
    const to = Math.min(
      peaks.length,
      Math.ceil((viewport.start + ((x + 1) / columns) * viewport.span) / secondsPerPeak)
    )
    for (let index = from; index < to; index++) {
      result[x] = Math.max(result[x], clampTime(peaks[index], 1))
    }
  }
  return result
}

export function waveformSourceKey(source) {
  if (source?.type === 'library' && source.id != null) return `library:${source.id}`
  return source?.file_path ? `file:${source.file_path}` : ''
}

export function isWaveformSourcePlaying(source, track) {
  if (!track || !waveformSourceKey(source)) return false
  return source.type === 'library' && source.id != null
    ? source.id === track.id
    : source.file_path === track.file_path
}
