import { computed, ref, watch } from 'vue'

export function useEditLyricsV2Playback({
  audioSource,
  syncedLines,
  progress,
  playingTrack,
  status,
  playTrack,
  resume,
  seek,
  duration,
  selectedLineIndex,
}) {
  const loopEnabled = ref(false)
  const loopLeadSeconds = ref(1)
  const loopTailSeconds = ref(0.5)
  let awaitingLoopSeek = false
  const boundedContext = value =>
    Number.isFinite(Number(value)) ? Math.min(5, Math.max(0, Number(value))) : 0
  const loopRange = computed(() => {
    const index = selectedLineIndex?.value
    const line = syncedLines.value[index]
    if (!Number.isFinite(line?.start_ms)) return null
    const endMs = Number.isFinite(line.end_ms)
      ? line.end_ms
      : syncedLines.value[index + 1]?.start_ms
    if (!Number.isFinite(endMs) || endMs <= line.start_ms) return null
    const start = Math.max(0, line.start_ms / 1000 - boundedContext(loopLeadSeconds.value))
    const end = Math.min(
      duration?.value || Infinity,
      endMs / 1000 + boundedContext(loopTailSeconds.value)
    )
    return end > start ? { start, end } : null
  })
  // Helper to check if the playing track matches the audio source
  const isPlayingCorrectTrack = () => {
    if (!playingTrack.value || !audioSource.value) {
      return false
    }
    return audioSource.value.type === 'library'
      ? playingTrack.value.id === audioSource.value.id
      : playingTrack.value.file_path === audioSource.value.file_path
  }

  const playLineAtOffset = async (lineIndex, offsetMs = 0) => {
    if (!audioSource.value) {
      return
    }

    const lineStartMs = syncedLines.value[lineIndex]?.start_ms
    const baseStartMs = Number.isFinite(lineStartMs) ? lineStartMs : progress.value * 1000
    const seekTo = Math.max(0, baseStartMs + offsetMs) / 1000

    if (!isPlayingCorrectTrack()) {
      await playTrack(audioSource.value)
    } else if (status.value === 'paused') {
      await resume()
    }

    seek(seekTo)
  }

  const playLine = async lineIndex => {
    return playLineAtOffset(lineIndex, 0)
  }

  const resumeOrPlay = () => {
    if (status.value === 'paused' && isPlayingCorrectTrack()) {
      resume()
      return
    }

    if (audioSource.value) {
      playTrack(audioSource.value)
    }
  }

  const toggleLoop = async () => {
    if (loopEnabled.value) {
      loopEnabled.value = false
      return
    }
    if (!loopRange.value) return
    loopEnabled.value = true
    awaitingLoopSeek = false
    try {
      await playLineAtOffset(selectedLineIndex.value, -boundedContext(loopLeadSeconds.value) * 1000)
    } catch (error) {
      loopEnabled.value = false
      throw error
    }
  }

  watch([progress, status], () => {
    if (!loopEnabled.value) return
    if (!isPlayingCorrectTrack() || !loopRange.value) {
      loopEnabled.value = false
      return
    }
    if (status.value !== 'playing' && status.value !== 'stopped') return
    const { start, end } = loopRange.value
    if (progress.value >= start && progress.value < end) awaitingLoopSeek = false
    if (progress.value >= end && !awaitingLoopSeek) {
      awaitingLoopSeek = true
      seek(start)
    }
  })

  if (selectedLineIndex) {
    watch(selectedLineIndex, () => {
      loopEnabled.value = false
      awaitingLoopSeek = false
    })
  }

  return {
    loopEnabled,
    loopLeadSeconds,
    loopTailSeconds,
    canLoop: computed(() => !!loopRange.value),
    toggleLoop,
    playLine,
    playLineAtOffset,
    resumeOrPlay,
  }
}
