// A single expanded timeline keeps all time/pixel ratios linear, including short words.
export function scrollToTimelineTime({ timeMs, startMs, endMs, width, visibleWidth, scrollLeft }) {
  if (
    ![timeMs, startMs, endMs, width, visibleWidth, scrollLeft].every(Number.isFinite) ||
    endMs <= startMs ||
    width <= 0 ||
    visibleWidth <= 0 ||
    timeMs < startMs ||
    timeMs > endMs
  )
    return scrollLeft
  const x = ((timeMs - startMs) / (endMs - startMs)) * width
  const margin = Math.min(24, visibleWidth / 4)
  const target =
    x < scrollLeft + margin
      ? x - margin
      : x > scrollLeft + visibleWidth - margin
        ? x - visibleWidth + margin
        : scrollLeft
  return Math.max(0, Math.min(width - visibleWidth, target))
}
