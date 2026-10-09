import { computed, watch } from 'vue'

// Select the latest cue, never an earlier overlapping chorus. Blank cues clear the display.
export function currentLyricIndex(lines, timeMs) {
  if (!Number.isFinite(timeMs) || timeMs < 0) return -1
  let index = -1
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const value = lines[i]?.start_ms
    if (Number.isFinite(value) && value >= 0 && value <= timeMs && value >= start) {
      index = i
      start = value
    }
  }
  if (index < 0) return -1
  const line = lines[index]
  if (!line.text?.trim() || (Number.isFinite(line.end_ms) && timeMs >= line.end_ms)) return -1
  return index
}

export function useLyricsFollow({
  lines,
  timeMs,
  playing,
  enabled,
  blocked,
  selectedIndex,
  onSelect,
}) {
  let expectedSelection = null
  const currentIndex = computed(() => currentLyricIndex(lines.value, timeMs.value))
  watch(
    selectedIndex,
    index => {
      if (index === expectedSelection) expectedSelection = null
      else {
        expectedSelection = null
        enabled.value = false
      }
    },
    { flush: 'sync' }
  )
  watch(
    [currentIndex, enabled, blocked, playing, selectedIndex],
    () => {
      if (!enabled.value || !playing.value || blocked.value || currentIndex.value < 0) return
      if (currentIndex.value === selectedIndex.value) return
      expectedSelection = currentIndex.value
      onSelect(currentIndex.value)
    },
    { immediate: true }
  )
  return { currentIndex }
}
