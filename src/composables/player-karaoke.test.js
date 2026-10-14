import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { usePlayer } from './player.js'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }))

const player = usePlayer()
const wordTimedLyrics = `version: "1.0"
metadata: { title: Song, artist: Singer, duration_ms: 10000 }
lines:
  - text: Hello
    start_ms: 1000
    words:
      - { text: Hello, start_ms: 1000, end_ms: 2000 }
`

beforeEach(() => {
  vi.clearAllMocks()
  invoke.mockResolvedValue(undefined)
  player.playingTrack.value = null
  player.karaokeMode.value = false
  player.karaokeLrcLyrics.value = ''
  player.karaokeElrcLyricsfile.value = ''
})

describe('karaoke player entry', () => {
  it('opens the karaoke display and starts the selected library track', async () => {
    const track = {
      id: 17,
      title: 'Timed song',
      artist_name: 'Singer',
      album_name: 'Album',
      duration: 180,
    }

    await player.playKaraoke(track)

    expect(player.karaokeMode.value).toBe(true)
    expect(player.playingTrack.value).toMatchObject(track)
    expect(invoke).toHaveBeenCalledWith('play_track', {
      trackId: 17,
      filePath: null,
      title: 'Timed song',
      albumName: 'Album',
      artistName: 'Singer',
      albumArtistName: undefined,
      duration: 180,
    })
  })

  it.each(['playing', 'paused'])(
    'keeps current playback position and %s state when entering karaoke for the same track',
    async status => {
      const track = { id: 21, title: 'Already playing', lyricsfile: wordTimedLyrics }
      player.playingTrack.value = track
      player.status.value = status
      player.progress.value = 42.75

      await player.playKaraoke({ ...track })

      expect(player.karaokeMode.value).toBe(true)
      expect(player.status.value).toBe(status)
      expect(player.progress.value).toBe(42.75)
      expect(invoke).not.toHaveBeenCalledWith('play_track', expect.anything())
      expect(invoke).toHaveBeenCalledWith('get_karaoke_lyrics_formats', { trackId: 21 })
    }
  )

  it('closes after playback cannot start and does not open for a missing track', async () => {
    await player.playKaraoke(null)
    expect(player.karaokeMode.value).toBe(false)
    expect(invoke).not.toHaveBeenCalled()

    invoke.mockRejectedValueOnce(new Error('Audio unavailable'))
    await expect(player.playKaraoke({ id: 18, title: 'Unavailable' })).rejects.toThrow(
      'Audio unavailable'
    )
    expect(player.karaokeMode.value).toBe(false)
  })

  it('can close and reopen the display without resetting playback', () => {
    player.playingTrack.value = { id: 19 }
    player.openKaraoke()
    player.closeKaraoke()

    expect(player.karaokeMode.value).toBe(false)
    expect(player.playingTrack.value).toEqual({ id: 19 })
  })

  it('loads valid alternate LRC and ELRC sidecars for the karaoke format switch', async () => {
    invoke.mockImplementation(async command => {
      if (command === 'get_karaoke_lyrics_formats') {
        return { lrc: '[00:01.00]Hello', elrcLyricsfile: wordTimedLyrics }
      }
      return undefined
    })

    await player.playKaraoke({ id: 20, title: 'Dual format', duration: 10 })

    expect(player.karaokeLrcLyrics.value).toBe('[00:01.00]Hello')
    expect(player.karaokeElrcLyricsfile.value).toBe(wordTimedLyrics)
  })

  it('clears stale sidecar lyrics when the next track sidecar cannot be read', async () => {
    player.karaokeMode.value = true
    player.karaokeLrcLyrics.value = '[00:01.00]Old track lyric'
    player.karaokeElrcLyricsfile.value = wordTimedLyrics
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    invoke.mockImplementation(async command => {
      if (command === 'get_karaoke_lyrics_formats') throw new Error('Sidecar disappeared')
      return undefined
    })

    await player.playKaraoke({ id: 22, title: 'New track' })

    expect(player.karaokeMode.value).toBe(true)
    expect(player.karaokeLrcLyrics.value).toBe('')
    expect(player.karaokeElrcLyricsfile.value).toBe('')
    vi.restoreAllMocks()
  })

  it('karaoke shuffle skips tracks without sidecars and allows a sidecar-only LRC track', async () => {
    player.playingTrack.value = { id: 1, title: 'Current', lyricsfile: wordTimedLyrics }
    player.setQueue([1, 2, 3])
    player.shuffle.value = true
    player.openKaraoke()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    invoke.mockImplementation(async (command, args) => {
      if (command === 'get_karaoke_lyrics_formats') {
        return args.trackId === 2 ? { lrc: '[00:01.00]Timed lyric' } : { lrc: null }
      }
      if (command === 'get_track') {
        return args.trackId === 3
          ? { id: 3, title: 'No lyrics', lyricsfile: null }
          : { id: 2, title: 'Sidecar-only track', lyricsfile: null }
      }
      return undefined
    })

    await player.playAdjacentTrack(1)

    expect(invoke).toHaveBeenCalledWith('get_karaoke_lyrics_formats', { trackId: 3 })
    expect(invoke).not.toHaveBeenCalledWith('get_track', { trackId: 3 })
    expect(invoke).toHaveBeenCalledWith('get_track', { trackId: 2 })
    expect(player.playingTrack.value.id).toBe(2)
    expect(player.karaokeMode.value).toBe(true)
    vi.restoreAllMocks()
  })

  it('Repeat all replays the current timed track when every other track lacks lyrics', async () => {
    player.playingTrack.value = { id: 1, title: 'Only timed track', lyricsfile: wordTimedLyrics }
    player.setQueue([1, 2])
    player.repeatMode.value = 'all'
    player.openKaraoke()
    invoke.mockImplementation(async (command, args) => {
      if (command === 'get_karaoke_lyrics_formats') {
        return args.trackId === 1 ? { lrc: '[00:01.00]Timed lyric' } : { lrc: null }
      }
      if (command === 'get_track') return { id: 2, title: 'Untimed track', lyricsfile: null }
      return undefined
    })

    await player.playAdjacentTrack(1)

    expect(player.playingTrack.value.id).toBe(1)
    expect(invoke).toHaveBeenCalledWith('play_track', expect.objectContaining({ trackId: 1 }))
    expect(player.karaokeMode.value).toBe(true)
  })
})
