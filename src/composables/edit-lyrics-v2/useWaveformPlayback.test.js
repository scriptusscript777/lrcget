import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { useWaveformPlayback } from './useWaveformPlayback.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  invoke.mockResolvedValue(undefined)
})
const setup = (track = { id: 1 }, initialStatus = 'paused') => {
  const scope = effectScope()
  const audioSource = ref({ type: 'library', id: 1 })
  const playingTrack = ref(track)
  const status = ref(initialStatus)
  const progress = ref(45)
  const playTrack = vi.fn(async source => {
    playingTrack.value = source
  })
  const seek = vi.fn().mockResolvedValue(undefined)
  const toast = { error: vi.fn() }
  const state = scope.run(() =>
    useWaveformPlayback({ audioSource, playingTrack, status, progress, playTrack, seek, toast })
  )
  return { ...state, scope, audioSource, playingTrack, status, progress, playTrack, seek, toast }
}

describe('waveform playback isolation', () => {
  it('follows only an active playing matching source', async () => {
    const state = setup()
    expect(state.waveformPlaying.value).toBe(false)
    state.status.value = 'playing'
    expect(state.waveformPlaying.value).toBe(true)
    state.playingTrack.value = { id: 2 }
    expect(state.waveformPlaying.value).toBe(false)
    state.playingTrack.value = { id: 1 }
    expect(state.waveformPlaying.value).toBe(false)
    state.progress.value = 2
    expect(state.waveformPlaying.value).toBe(true)
    state.status.value = 'paused'
    expect(state.waveformPlaying.value).toBe(false)
    state.scope.stop()
  })
  it('seeks a paused matching source without resuming or reloading', async () => {
    const state = setup()
    await state.seekWaveform(12)
    expect(state.playTrack).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
    expect(state.seek).toHaveBeenCalledWith(12, { preservePaused: true, sourceReady: false })
    expect(state.waveformProgress.value).toBe(12)
    state.scope.stop()
  })

  it('keeps playing seeks playing', async () => {
    const state = setup({ id: 1 }, 'playing')
    await state.seekWaveform(12)
    expect(state.seek).toHaveBeenCalledWith(12, { preservePaused: false, sourceReady: false })
    state.scope.stop()
  })

  it('preserves the newly loaded paused source on the first queued seek', async () => {
    const state = setup({ id: 2 }, 'playing')
    invoke.mockImplementation(async command => {
      if (command === 'pause_track') state.status.value = 'paused'
    })
    await state.seekWaveform(12)
    expect(state.playTrack).toHaveBeenCalledOnce()
    expect(state.seek).toHaveBeenCalledWith(12, { preservePaused: true, sourceReady: true })
    expect(invoke.mock.calls.map(([command]) => command)).toEqual(['pause_track'])
    state.scope.stop()
  })

  it('hides old progress and loads the editor source before seeking', async () => {
    const state = setup({ id: 2 })
    expect(state.waveformProgress.value).toBeNull()
    await state.initializeAudio()
    expect(state.playTrack).toHaveBeenCalledWith({ type: 'library', id: 1 })
    expect(state.waveformProgress.value).toBe(0)
    state.progress.value = 2
    await nextTick()
    expect(state.waveformProgress.value).toBe(2)
    state.scope.stop()
  })

  it('shares pending audio load and serializes seeks', async () => {
    const state = setup({ id: 2 })
    let finish
    state.playTrack.mockImplementation(source => {
      state.playingTrack.value = source
      return new Promise(resolve => {
        finish = resolve
      })
    })
    const initialization = state.initializeAudio()
    const first = state.seekWaveform(2)
    const second = state.seekWaveform(3)
    await nextTick()
    expect(state.waveformProgress.value).toBeNull()
    expect(state.seek).not.toHaveBeenCalled()
    finish()
    await Promise.all([initialization, first, second])
    expect(state.playTrack).toHaveBeenCalledTimes(1)
    expect(state.seek.mock.calls.map(([position]) => position)).toEqual([2, 3])
    state.scope.stop()
  })

  it.each(['source', 'unmount', 'other-track'])(
    'ignores a pending seek after %s changes',
    async mode => {
      const state = setup({ id: 2 })
      let finish
      state.playTrack.mockImplementation(source => {
        state.playingTrack.value = source
        return new Promise(resolve => {
          finish = resolve
        })
      })
      const pending = state.seekWaveform(5)
      await nextTick()
      if (mode === 'source') {
        state.audioSource.value = { type: 'library', id: 3 }
        state.audioSource.value = { type: 'library', id: 1 }
      } else if (mode === 'unmount') state.scope.stop()
      else state.playingTrack.value = { id: 3 }
      finish()
      await pending
      expect(state.seek).not.toHaveBeenCalled()
      expect(invoke).not.toHaveBeenCalled()
      state.scope.stop()
    }
  )

  it('reports failed loading and retries even though player identity changed optimistically', async () => {
    const state = setup({ id: 2 })
    state.playTrack.mockImplementationOnce(async source => {
      state.playingTrack.value = source
      throw new Error('load failed')
    })
    await state.seekWaveform(2)
    expect(state.toast.error).toHaveBeenCalledWith('Error: load failed')
    expect(state.waveformProgress.value).toBeNull()
    expect(state.seek).not.toHaveBeenCalled()
    await state.seekWaveform(3)
    expect(state.playTrack).toHaveBeenCalledTimes(2)
    expect(state.seek).toHaveBeenCalledWith(3, { preservePaused: true, sourceReady: true })
    state.seek.mockRejectedValueOnce(new Error('seek failed'))
    await state.seekWaveform(4)
    expect(state.toast.error).toHaveBeenLastCalledWith('Error: seek failed')
    state.scope.stop()
  })

  it.each(['stopped', 'playing'])(
    'keeps a freshly loaded source paused despite a stale %s event',
    async initialStatus => {
      const state = setup({ id: 2 }, initialStatus)
      await state.seekWaveform(2)
      expect(state.playTrack).toHaveBeenCalledTimes(1)
      expect(invoke).toHaveBeenCalledWith('pause_track')
      expect(state.seek).toHaveBeenCalledWith(2, { preservePaused: true, sourceReady: true })
      state.scope.stop()
    }
  )
})
