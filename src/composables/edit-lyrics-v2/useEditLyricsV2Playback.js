import { computed, onScopeDispose, ref, watch } from 'vue'
import { waveformSourceKey } from '@/utils/waveform-viewport.js'

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
  markerPreview,
  onError = () => {},
}) {
  const loopEnabled = ref(false)
  const loopLeadSeconds = ref(0)
  const loopTailSeconds = ref(0)
  let awaitingLoopSeek = false
  let initializingLoop = false
  let loopOperation = 0
  let playOperation = 0
  let disposed = false
  const stopLoop = () => {
    loopOperation++
    loopEnabled.value = false
    awaitingLoopSeek = false
    initializingLoop = false
  }
  const failLoop = (error, operation) => {
    if (operation !== loopOperation) return
    stopLoop()
    onError(error)
  }
  const boundedContext = value =>
    Number.isFinite(Number(value)) ? Math.min(5, Math.max(0, Number(value))) : 0
  const loopRange = computed(() => {
    const index = selectedLineIndex?.value
    const line = syncedLines.value[index]
    if (!Number.isFinite(line?.start_ms)) return null
    const preview = markerPreview?.value
    const usePreview = preview?.line === line && preview?.lineIndex === index
    const startMs = usePreview ? preview.startMs : line.start_ms
    const endMs = usePreview
      ? preview.endMs
      : Number.isFinite(line.end_ms)
        ? line.end_ms
        : syncedLines.value[index + 1]?.start_ms
    if (!Number.isFinite(startMs) || startMs < 0 || !Number.isFinite(endMs) || endMs <= startMs)
      return null
    const start = Math.max(0, startMs / 1000 - boundedContext(loopLeadSeconds.value))
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

  const playLineAtOffset = async (lineIndex, offsetMs = 0, { continuePlayback = false } = {}) => {
    const source = audioSource.value
    const line = syncedLines.value[lineIndex]
    if (!source || !line || !Number.isFinite(offsetMs) || disposed) return
    // Explicit Play continues through the recording; edit auditions preserve Loop.
    if (continuePlayback) stopLoop()
    const operation = ++playOperation
    const sourceKey = waveformSourceKey(source)
    const lineStartMs = line.start_ms
    const baseStartMs = Number.isFinite(lineStartMs)
      ? lineStartMs
      : isPlayingCorrectTrack() && Number.isFinite(progress.value)
        ? progress.value * 1000
        : 0
    const seekTo = Math.max(0, baseStartMs + offsetMs) / 1000
    try {
      if (!isPlayingCorrectTrack()) await playTrack(source)
      else if (status.value === 'paused') await resume()
      // A delayed resume/load must not seek another recording or an outdated lyric.
      if (
        disposed ||
        operation !== playOperation ||
        sourceKey !== waveformSourceKey(audioSource.value) ||
        !isPlayingCorrectTrack() ||
        syncedLines.value[lineIndex] !== line
      )
        return
      await seek(seekTo)
    } catch (error) {
      if (!disposed && operation === playOperation) onError(error)
    }
  }

  const playLine = async lineIndex => {
    return playLineAtOffset(lineIndex, 0, { continuePlayback: true })
  }

  const resumeOrPlay = async () => {
    if (disposed) return
    try {
      if (status.value === 'paused' && isPlayingCorrectTrack()) await resume()
      else if (audioSource.value) await playTrack(audioSource.value)
    } catch (error) {
      if (!disposed) onError(error)
    }
  }

  const toggleLoop = async () => {
    if (loopEnabled.value) {
      stopLoop()
      return
    }
    if (!audioSource.value || !loopRange.value) return
    const operation = ++loopOperation
    loopEnabled.value = true
    initializingLoop = true
    awaitingLoopSeek = false
    try {
      if (!isPlayingCorrectTrack()) await playTrack(audioSource.value)
      else if (status.value === 'paused') await resume()
      // A canceled/changed editor must not seek a different recording after an await.
      if (operation !== loopOperation || !loopEnabled.value || !isPlayingCorrectTrack()) return
      if (loopRange.value) await seek(loopRange.value.start)
    } catch (error) {
      failLoop(error, operation)
    } finally {
      if (operation === loopOperation) initializingLoop = false
    }
  }

  watch(loopRange, () => {
    awaitingLoopSeek = false
  })
  watch([progress, status, loopRange, playingTrack], () => {
    if (!loopEnabled.value || initializingLoop) return
    if (!isPlayingCorrectTrack() || !loopRange.value) {
      stopLoop()
      return
    }
    if (status.value !== 'playing' && status.value !== 'stopped') return
    const { start, end } = loopRange.value
    if (progress.value >= start && progress.value < end) awaitingLoopSeek = false
    if ((progress.value >= end || progress.value < start) && !awaitingLoopSeek) {
      awaitingLoopSeek = true
      const operation = loopOperation
      // Both synchronous and asynchronous player failures stop the loop instead of retrying forever.
      try {
        Promise.resolve(seek(start)).catch(error => failLoop(error, operation))
      } catch (error) {
        failLoop(error, operation)
      }
    }
  })

  if (selectedLineIndex) {
    watch(selectedLineIndex, stopLoop, { flush: 'sync' })
  }
  watch(audioSource, stopLoop, { deep: true, flush: 'sync' })
  onScopeDispose(() => {
    disposed = true
    playOperation++
    stopLoop()
  })

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
