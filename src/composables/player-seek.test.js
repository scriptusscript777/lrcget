import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { usePlayer } from './player.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))

const player = usePlayer()
beforeEach(() => {
  vi.resetAllMocks()
  invoke.mockResolvedValue(undefined)
  player.playingTrack.value = null
  player.status.value = 'stopped'
})

describe('shared player seeking', () => {
  it('does nothing without a selected source', async () => {
    await player.seek(2)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('preserves pause only when explicitly requested', async () => {
    player.playingTrack.value = { id: 1 }
    player.status.value = 'paused'
    await player.seek(2, { preservePaused: true })
    expect(invoke).toHaveBeenLastCalledWith('seek_track', { position: 2, preservePaused: true })
    await player.seek(3)
    expect(invoke).toHaveBeenLastCalledWith('seek_track', { position: 3, preservePaused: false })
  })

  it('awaits playback initialization before seeking a stopped file-based track', async () => {
    player.playingTrack.value = { file_path: '/temporary/fixture.wav', title: 'Fixture' }
    let finish
    invoke.mockImplementation(command =>
      command === 'play_track'
        ? new Promise(resolve => {
            finish = resolve
          })
        : Promise.resolve()
    )
    const seeking = player.seek(2)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke.mock.calls[0][1]).toMatchObject({
      trackId: null,
      filePath: '/temporary/fixture.wav',
    })
    finish()
    await seeking
    expect(invoke).toHaveBeenLastCalledWith('seek_track', { position: 2, preservePaused: false })
  })

  it('does not seek if playback creation fails', async () => {
    player.playingTrack.value = { id: 1 }
    invoke.mockRejectedValue(new Error('Unavailable audio'))
    await expect(player.seek(2)).rejects.toThrow('Unavailable audio')
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('does not restart already initialized audio while its stopped event is stale', async () => {
    player.playingTrack.value = { id: 1 }
    await player.seek(2, { preservePaused: true, sourceReady: true })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('seek_track', { position: 2, preservePaused: true })
  })
})
