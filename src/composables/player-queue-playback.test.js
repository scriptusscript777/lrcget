import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { usePlayer } from './player.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))

const player = usePlayer()
const playerStateHandler = listen.mock.calls.find(([eventName]) => eventName === 'player-state')[1]

const emitPlayerState = (status, progress = 4, duration = 5) =>
  playerStateHandler({
    payload: {
      status,
      progress,
      duration,
      volume: 1,
      playback_speed: 1,
    },
  })

const playThroughEnd = async () => {
  await emitPlayerState('playing')
  await emitPlayerState('stopped', 5)
}

beforeEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 160))
  vi.clearAllMocks()
  invoke.mockImplementation(async command => {
    if (command === 'get_track') return { id: 2, title: 'Next track' }
    return undefined
  })
  player.setQueue([1, 2])
  player.shuffle.value = false
  player.repeatMode.value = 'off'
  player.playingTrack.value = { id: 1, title: 'Current track' }
})

describe('player queue playback modes', () => {
  it('restarts the current track at its natural end in Repeat one mode', async () => {
    player.repeatMode.value = 'one'

    await playThroughEnd()

    expect(invoke).toHaveBeenCalledWith('play_track', {
      trackId: 1,
      filePath: null,
      title: 'Current track',
      albumName: undefined,
      artistName: undefined,
      albumArtistName: undefined,
      duration: undefined,
    })
  })

  it('advances to the next track at the natural end in Repeat all mode', async () => {
    player.repeatMode.value = 'all'

    await playThroughEnd()

    expect(invoke).toHaveBeenCalledWith('get_track', { trackId: 2 })
    expect(player.playingTrack.value.id).toBe(2)
  })

  it('wraps to the first track when Repeat all reaches the queue end', async () => {
    player.repeatMode.value = 'all'
    player.playingTrack.value = { id: 2, title: 'Last track' }
    invoke.mockImplementation(async command => {
      if (command === 'get_track') return { id: 1, title: 'First track' }
      return undefined
    })

    await playThroughEnd()

    expect(invoke).toHaveBeenCalledWith('get_track', { trackId: 1 })
    expect(player.playingTrack.value.id).toBe(1)
  })

  it('selects a different queue track in Shuffle mode and does not advance past the end otherwise', async () => {
    player.shuffle.value = true

    await playThroughEnd()

    expect(invoke).toHaveBeenCalledWith('get_track', { trackId: 2 })
    expect(player.playingTrack.value.id).toBe(2)

    await new Promise(resolve => setTimeout(resolve, 160))
    vi.clearAllMocks()
    player.shuffle.value = false
    player.repeatMode.value = 'off'
    player.playingTrack.value = { id: 2, title: 'Last track' }
    await playThroughEnd()
    expect(invoke).not.toHaveBeenCalledWith('get_track', expect.anything())
  })
})
