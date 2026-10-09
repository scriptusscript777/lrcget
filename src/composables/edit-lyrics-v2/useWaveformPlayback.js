import { computed, onScopeDispose, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { isWaveformSourcePlaying, waveformSourceKey } from '@/utils/waveform-viewport.js'

export function useWaveformPlayback({
  audioSource,
  playingTrack,
  status,
  progress,
  playTrack,
  seek,
  toast,
}) {
  const matches = computed(() => isWaveformSourcePlaying(audioSource.value, playingTrack.value))
  const cursor = ref(matches.value ? progress.value : null)
  const loading = ref(false)
  const failedKey = ref('')
  const waveformProgress = computed(() =>
    matches.value && !loading.value && failedKey.value !== waveformSourceKey(audioSource.value)
      ? cursor.value
      : null
  )
  let disposed = false
  let generation = 0
  let audioLoad = null
  let seekQueue = Promise.resolve()

  watch(
    () => waveformSourceKey(audioSource.value),
    () => {
      generation++
      cursor.value = null
    },
    { flush: 'sync' }
  )
  watch(
    playingTrack,
    () => {
      cursor.value = null
    },
    { flush: 'sync' }
  )
  watch(
    [progress, status],
    () => {
      if (matches.value && !loading.value) cursor.value = progress.value
    },
    { flush: 'sync' }
  )
  onScopeDispose(() => {
    disposed = true
    generation++
  })

  const ensureAudio = async source => {
    const key = waveformSourceKey(source)
    if (!key || disposed) return
    if (audioLoad?.key === key && audioLoad.generation === generation) return audioLoad.promise
    if (
      isWaveformSourcePlaying(source, playingTrack.value) &&
      status.value !== 'stopped' &&
      failedKey.value !== key
    )
      return
    loading.value = true
    const pending = { key, generation, promise: null }
    audioLoad = pending
    pending.promise = (async () => {
      try {
        await playTrack(source)
        if (
          disposed ||
          pending.generation !== generation ||
          !isWaveformSourcePlaying(source, playingTrack.value)
        )
          return
        await invoke('pause_track')
        if (
          disposed ||
          pending.generation !== generation ||
          !isWaveformSourcePlaying(source, playingTrack.value)
        )
          return
        // Player identity changes before state events arrive. Use the known new-track position,
        // not a previous track's progress, until the next playback update.
        cursor.value = 0
        failedKey.value = ''
        return true
      } catch (error) {
        if (pending.generation === generation) failedKey.value = key
        throw error
      } finally {
        if (audioLoad === pending) {
          audioLoad = null
          loading.value = false
        }
      }
    })()
    return pending.promise
  }

  const reportError = error => {
    if (!disposed) toast.error(error?.toString?.() || 'Failed to seek audio')
  }
  const initializeAudio = () => {
    if (!matches.value) return ensureAudio({ ...audioSource.value }).catch(reportError)
  }
  const seekWaveform = seconds => {
    const source = { ...audioSource.value }
    const key = waveformSourceKey(source)
    const requestGeneration = generation
    if (!key || !Number.isFinite(seconds)) return Promise.resolve()
    // Serialize clicks through track loading and invalidate queued actions on source change.
    seekQueue = seekQueue
      .then(async () => {
        if (disposed || requestGeneration !== generation) return
        const loadedPaused = await ensureAudio(source)
        if (
          disposed ||
          requestGeneration !== generation ||
          !isWaveformSourcePlaying(source, playingTrack.value)
        )
          return
        await seek(Math.max(0, seconds), {
          // The player-state event can trail the completed load/pause commands.
          // Do not restart/resume freshly loaded audio based on that stale event.
          preservePaused: loadedPaused === true || status.value === 'paused',
          sourceReady: loadedPaused === true,
        })
        if (!disposed && requestGeneration === generation) cursor.value = Math.max(0, seconds)
      })
      .catch(reportError)
    return seekQueue
  }
  const waveformPlaying = computed(
    () => Number.isFinite(waveformProgress.value) && status.value === 'playing'
  )
  return { waveformProgress, waveformPlaying, initializeAudio, seekWaveform }
}
