import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { useAudioWaveform } from './useAudioWaveform.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
const data = { duration: 10, secondsPerPeak: 1, peaks: [0, 1, 0.5] }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const setup = (initial = { type: 'library', id: 1 }) => {
  const scope = effectScope()
  const source = ref(initial)
  const state = scope.run(() => useAudioWaveform(source))
  return { scope, source, ...state }
}

describe('waveform request lifecycle', () => {
  it('requests once per source, not metadata changes, and uses the exact contract', async () => {
    invoke.mockResolvedValue(data)
    const state = setup()
    await nextTick()
    expect(invoke).toHaveBeenCalledWith('get_audio_waveform', { trackId: 1, filePath: null })
    state.source.value.title = 'Updated'
    state.source.value = { type: 'library', id: 1, title: 'Same source' }
    await nextTick()
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(state.waveform.value).toEqual(data)
    state.source.value = { type: 'file', file_path: '/audio.flac' }
    await nextTick()
    expect(invoke).toHaveBeenLastCalledWith('get_audio_waveform', {
      trackId: null,
      filePath: '/audio.flac',
    })
    state.scope.stop()
  })

  it('ignores old responses on source change and clears retained data on disposal', async () => {
    const old = deferred(),
      current = deferred()
    invoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
    const state = setup()
    state.source.value = { type: 'library', id: 2 }
    old.resolve(data)
    await nextTick()
    expect(state.waveform.value).toBeNull()
    expect(state.loading.value).toBe(true)
    current.resolve({ ...data, duration: 20 })
    await nextTick()
    expect(state.waveform.value.duration).toBe(20)
    state.scope.stop()
    expect(state.waveform.value).toBeNull()
  })

  it('ignores failure after unmount and cannot retry a disposed scope', async () => {
    const pending = deferred()
    invoke.mockReturnValue(pending.promise)
    const state = setup()
    state.scope.stop()
    pending.reject(new Error('late failure'))
    await nextTick()
    expect(state.error.value).toBe('')
    await state.retry()
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('exposes recoverable errors and validates the response', async () => {
    invoke
      .mockRejectedValueOnce('Decoder unavailable')
      .mockResolvedValueOnce({ ...data, duration: NaN })
      .mockResolvedValueOnce(data)
    const state = setup()
    await nextTick()
    expect(state.error.value).toContain('Decoder unavailable')
    expect(state.loading.value).toBe(false)
    await state.retry()
    expect(state.error.value).toContain('No usable waveform')
    await state.retry()
    expect(state.error.value).toBe('')
    expect(state.waveform.value).toEqual(data)
    state.scope.stop()
  })

  it('clears state without invoking for unavailable audio', async () => {
    invoke.mockResolvedValue(data)
    const state = setup()
    await nextTick()
    state.source.value = { type: 'file' }
    expect(state.waveform.value).toBeNull()
    expect(state.loading.value).toBe(false)
    expect(invoke).toHaveBeenCalledTimes(1)
    state.scope.stop()
  })
})
