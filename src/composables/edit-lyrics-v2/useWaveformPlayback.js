import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
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
  const pendingSeek = shallowRef(null)
  const waveformProgress = computed(() => {
    if (failedKey.value === waveformSourceKey(audioSource.value)) return null
    if (pendingSeek.value) return pendingSeek.value.target
    return matches.value && !loading.value ? cursor.value : null
  })
  let disposed = false
  let generation = 0
  let audioLoad = null
  let seekQueue = Promise.resolve()
  const clearPendingSeek = () => {
    clearTimeout(pendingSeek.value?.timer)
    pendingSeek.value = null
  }

  watch(
    () => waveformSourceKey(audioSource.value),
    () => {
      generation++
      cursor.value = null
      clearPendingSeek()
    },
    { flush: 'sync' }
  )
  watch(
    playingTrack,
    () => {
      cursor.value = null
    },
    // Batch cursor invalidation with player events, before the modal slot renders.
    // Synchronous writes here can invalidate its computed dependencies mid-notification.
    { flush: 'pre' }
  )
  watch(
    [progress, status],
    () => {
      if (!matches.value || loading.value) return
      const pending = pendingSeek.value
      if (pending) {
        // Load/resume events can contain the position from before the seek.
        // Keep the selected point until the audio thread acknowledges it.
        if (pending.awaitingCommand || !Number.isFinite(progress.value)) return
        if (Math.abs(progress.value - pending.target) > 0.25) return
        clearPendingSeek()
      }
      cursor.value = progress.value
    },
    // Update after identity changes settle, before rendering the editor's modal slot.
    { flush: 'pre' }
  )
  onScopeDispose(() => {
    disposed = true
    generation++
    clearPendingSeek()
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
  const seekWaveform = (seconds, { play = false } = {}) => {
    const source = { ...audioSource.value }
    const key = waveformSourceKey(source)
    const requestGeneration = generation
    if (!key || !Number.isFinite(seconds)) return Promise.resolve()
    // Serialize clicks through track loading and invalidate queued actions on source change.
    seekQueue = seekQueue
      .then(async () => {
        if (disposed || requestGeneration !== generation) return
        const pending = { target: Math.max(0, seconds), awaitingCommand: true, timer: null }
        clearPendingSeek()
        pendingSeek.value = pending
        try {
          const loadedPaused = await ensureAudio(source)
          if (
            disposed ||
            requestGeneration !== generation ||
            !isWaveformSourcePlaying(source, playingTrack.value)
          ) {
            if (pendingSeek.value === pending) clearPendingSeek()
            return
          }
          await seek(pending.target, {
            // Pointer playback is explicit. Inspection still respects a completed
            // load/pause even when the player-state event has not arrived yet.
            preservePaused: !play && (loadedPaused === true || status.value === 'paused'),
            sourceReady: loadedPaused === true,
          })
          if (
            !disposed &&
            requestGeneration === generation &&
            isWaveformSourcePlaying(source, playingTrack.value)
          ) {
            cursor.value = pending.target
            pending.awaitingCommand = false
            // Bound acknowledgement waiting so an ended/clamped source can recover.
            pending.timer = setTimeout(() => {
              if (pendingSeek.value !== pending) return
              cursor.value = matches.value ? progress.value : null
              clearPendingSeek()
            }, 1000)
          } else if (pendingSeek.value === pending) {
            clearPendingSeek()
          }
        } catch (error) {
          if (pendingSeek.value === pending) clearPendingSeek()
          throw error
        }
      })
      .catch(reportError)
    return seekQueue
  }
  const waveformPlaying = computed(
    () =>
      matches.value &&
      !loading.value &&
      Number.isFinite(waveformProgress.value) &&
      status.value === 'playing'
  )
  return { waveformProgress, waveformPlaying, initializeAudio, seekWaveform }
}
