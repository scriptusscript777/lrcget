import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { waveformSourceKey } from '@/utils/waveform-viewport.js'

export function useAudioWaveform(source) {
  const waveform = shallowRef(null)
  const loading = ref(false)
  const error = ref('')
  const sourceKey = computed(() => waveformSourceKey(source.value))
  let generation = 0
  let disposed = false

  const load = async () => {
    if (disposed) return
    const request = ++generation
    waveform.value = null
    error.value = ''
    loading.value = !!sourceKey.value
    if (!sourceKey.value) return
    const current = source.value
    try {
      const result = await invoke('get_audio_waveform', {
        trackId: current.type === 'library' ? current.id : null,
        filePath: current.file_path || null,
      })
      if (request !== generation) return
      if (
        !Number.isFinite(result?.duration) ||
        result.duration <= 0 ||
        !Number.isFinite(result.secondsPerPeak) ||
        result.secondsPerPeak <= 0 ||
        !Array.isArray(result.peaks) ||
        !result.peaks.length ||
        result.peaks.some(peak => !Number.isFinite(peak) || peak < 0 || peak > 1)
      ) {
        throw new Error('No usable waveform data was returned')
      }
      waveform.value = result
    } catch (reason) {
      if (request === generation)
        error.value = `Waveform unavailable: ${String(reason?.message || reason)}`
    } finally {
      if (request === generation) loading.value = false
    }
  }

  watch(sourceKey, load, { immediate: true, flush: 'sync' })
  onScopeDispose(() => {
    // Backend decoding cannot be canceled; invalidate responses without retaining audio/cache.
    disposed = true
    generation++
    waveform.value = null
  })
  return { waveform, loading, error, retry: load, sourceKey }
}
