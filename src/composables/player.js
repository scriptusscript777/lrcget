import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getPlayerQueueState, selectAdjacentTrackId, setPlayerQueue } from './player-queue.js'
import { hasPlayableTimedLyrics, parseLrcLines } from '@/utils/lyricsfile.js'

const playingTrack = ref(null)
const karaokeMode = ref(false)
const karaokeLrcLyrics = ref('')
const karaokeElrcLyricsfile = ref('')
const karaokeNotice = ref('')
const status = ref('stopped')
const duration = ref(null)
const progress = ref(null)
const volume = ref(1.0)
const playbackSpeed = ref(1.0)
const { queue, shuffle, repeatMode } = getPlayerQueueState()
let previousPlayerStatus = 'stopped'
let suppressAutomaticAdvance = false
let karaokeNoticeTimer

const setKaraokeNotice = message => {
  karaokeNotice.value = message
  clearTimeout(karaokeNoticeTimer)
  if (message) karaokeNoticeTimer = setTimeout(() => (karaokeNotice.value = ''), 3500)
}

const karaokeCandidateIds = direction => {
  const ids = queue.value
  const currentIndex = ids.indexOf(playingTrack.value?.id)
  if (currentIndex < 0 || ids.length < 2) return []

  if (direction > 0 && shuffle.value) {
    const candidates = ids.filter(id => id !== playingTrack.value?.id)
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]]
    }
    return candidates
  }

  const candidates = []
  for (let step = 1; step < ids.length; step += 1) {
    let index = currentIndex + direction * step
    if (index < 0 || index >= ids.length) {
      if (repeatMode.value !== 'all') break
      index = (index + ids.length) % ids.length
    }
    candidates.push(ids[index])
  }
  return candidates
}

const hasPlayableKaraokeSidecar = async trackId => {
  try {
    const formats = await invoke('get_karaoke_lyrics_formats', { trackId })
    return (
      parseLrcLines(formats?.lrc).some(line => line.text.trim()) ||
      hasPlayableTimedLyrics({ lyricsfile: formats?.elrcLyricsfile })
    )
  } catch {
    // A missing/unreadable sidecar makes this queue item ineligible.
    return false
  }
}

const findKaraokeTrack = async direction => {
  for (const trackId of karaokeCandidateIds(direction)) {
    if (!(await hasPlayableKaraokeSidecar(trackId))) continue
    try {
      const track = await invoke('get_track', { trackId })
      if (track) return track
    } catch {
      // A removed/unavailable library entry should not block later queue items.
    }
  }
  if (
    repeatMode.value === 'all' &&
    playingTrack.value?.id !== undefined &&
    playingTrack.value?.id !== null &&
    (await hasPlayableKaraokeSidecar(playingTrack.value.id))
  ) {
    return playingTrack.value
  }
  return null
}

const playKaraokeTrack = async (track, { restart = false } = {}) => {
  if (!track) return
  const currentTrack = playingTrack.value
  const isSameTrack =
    currentTrack &&
    (track.id !== undefined && track.id !== null
      ? currentTrack.id === track.id
      : !currentTrack.id && currentTrack.file_path && currentTrack.file_path === track.file_path)
  setKaraokeNotice('')
  if (!karaokeMode.value) {
    karaokeLrcLyrics.value = ''
    karaokeElrcLyricsfile.value = ''
  }
  try {
    // Opening the lyric display for the current track must preserve its exact
    // playback position and playing/paused/stopped state.
    if (!isSameTrack || restart) await playTrack(track)
    if (track.id !== undefined && track.id !== null) {
      try {
        const formats = await invoke('get_karaoke_lyrics_formats', { trackId: track.id })
        if (playingTrack.value?.id === track.id) {
          karaokeLrcLyrics.value = formats?.lrc || ''
          karaokeElrcLyricsfile.value = formats?.elrcLyricsfile || ''
        }
      } catch (error) {
        // Playback and primary lyrics remain usable if an optional sidecar cannot be read.
        console.warn('Could not load alternate karaoke lyric formats:', error)
        if (playingTrack.value?.id === track.id) {
          karaokeLrcLyrics.value = ''
          karaokeElrcLyricsfile.value = ''
        }
      }
    } else {
      karaokeLrcLyrics.value = ''
      karaokeElrcLyricsfile.value = ''
    }
    karaokeMode.value = true
  } catch (error) {
    karaokeMode.value = false
    throw error
  }
}

const playTrack = track => {
  playingTrack.value = track
  suppressAutomaticAdvance = true

  let playbackRequest
  if (track.id !== undefined && track.id !== null) {
    playbackRequest = invoke('play_track', {
      trackId: track.id,
      filePath: null,
      title: track.title,
      albumName: track.album_name,
      artistName: track.artist_name,
      albumArtistName: track.album_artist_name,
      duration: track.duration,
    })
  } else if (track.file_path) {
    playbackRequest = invoke('play_track', {
      trackId: null,
      filePath: track.file_path,
      title: track.title,
      albumName: track.album_name,
      artistName: track.artist_name,
      albumArtistName: track.album_artist_name,
      duration: track.duration,
    })
  } else {
    suppressAutomaticAdvance = false
    return Promise.resolve()
  }

  return playbackRequest.finally(() => {
    // Ignore the stopped transition caused by replacing the previous track.
    setTimeout(() => {
      suppressAutomaticAdvance = false
    }, 150)
  })
}

listen('player-state', async event => {
  const previousStatus = previousPlayerStatus
  duration.value = event.payload.duration
  progress.value = event.payload.progress
  status.value = event.payload.status
  volume.value = event.payload.volume
  playbackSpeed.value = event.payload.playback_speed ?? 1.0
  previousPlayerStatus = status.value

  const endedNaturally = previousStatus === 'playing' && status.value === 'stopped'
  const reachedEnd =
    Number.isFinite(duration.value) &&
    Number.isFinite(progress.value) &&
    progress.value >= duration.value - 0.25
  if (endedNaturally && reachedEnd && !suppressAutomaticAdvance) {
    try {
      if (repeatMode.value === 'one' && playingTrack.value) {
        if (karaokeMode.value) await playKaraokeTrack(playingTrack.value, { restart: true })
        else await playTrack(playingTrack.value)
      } else {
        if (karaokeMode.value) {
          const nextTrack = await findKaraokeTrack(1)
          if (nextTrack) {
            await playKaraokeTrack(nextTrack, {
              restart: nextTrack.id === playingTrack.value?.id,
            })
          } else setKaraokeNotice('No more tracks with timed lyrics are available in this queue.')
        } else {
          const nextId = selectAdjacentTrackId(queue.value, playingTrack.value?.id, {
            shuffled: shuffle.value,
            repeat: repeatMode.value,
          })
          if (nextId !== null) {
            const nextTrack = await invoke('get_track', { trackId: nextId })
            if (nextTrack) await playTrack(nextTrack)
          }
        }
      }
    } catch (error) {
      console.error('Failed to advance playback queue:', error)
    }
  }
})

listen('reload-track-id', async event => {
  const payload = event.payload
  if (playingTrack.value && playingTrack.value.id === payload) {
    playingTrack.value = await invoke('get_track', { trackId: playingTrack.value.id })
  }
})

export function usePlayer() {
  const openKaraoke = () => {
    karaokeMode.value = true
  }

  const playKaraoke = track => playKaraokeTrack(track)

  const closeKaraoke = () => {
    karaokeMode.value = false
    setKaraokeNotice('')
  }

  const pause = () => {
    if (!playingTrack.value) {
      return
    }

    invoke('pause_track')
  }

  const resume = () => {
    if (!playingTrack.value) {
      return
    }

    return invoke('resume_track')
  }

  const seek = async (position, { preservePaused = false, sourceReady = false } = {}) => {
    if (!playingTrack.value) {
      return
    }

    if (status.value === 'stopped' && !sourceReady) {
      // File-based editor sources have no library ID. Await playback creation
      // before seeking so a stopped player cannot lose the seek command.
      await playTrack(playingTrack.value)
    }

    return invoke('seek_track', { position, preservePaused })
  }

  const stop = () => {
    if (!playingTrack.value) {
      return
    }

    invoke('stop_track')
  }

  const setVolume = volume => {
    invoke('set_volume', { volume })
  }

  const setPlaybackSpeed = playbackSpeedValue => {
    invoke('set_playback_speed', { playbackSpeed: playbackSpeedValue })
  }

  const playAdjacentTrack = async direction => {
    if (!playingTrack.value?.id) return
    if (karaokeMode.value) {
      const track = await findKaraokeTrack(direction)
      if (track) {
        await playKaraokeTrack(track, { restart: track.id === playingTrack.value?.id })
      } else setKaraokeNotice('No other tracks with timed lyrics are available in this queue.')
      return
    }
    const nextId = selectAdjacentTrackId(queue.value, playingTrack.value.id, {
      shuffled: direction > 0 && shuffle.value,
      repeat: repeatMode.value,
      direction,
    })
    if (nextId === null) return
    const track = await invoke('get_track', { trackId: nextId })
    if (track) await playTrack(track)
  }

  const toggleShuffle = () => {
    shuffle.value = !shuffle.value
  }

  const cycleRepeatMode = () => {
    repeatMode.value =
      repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  return {
    playingTrack,
    karaokeMode,
    karaokeLrcLyrics,
    karaokeElrcLyricsfile,
    karaokeNotice,
    status,
    duration,
    progress,
    volume,
    playbackSpeed,
    queue,
    shuffle,
    repeatMode,
    playTrack,
    openKaraoke,
    playKaraoke,
    closeKaraoke,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    setPlaybackSpeed,
    setQueue: setPlayerQueue,
    playAdjacentTrack,
    toggleShuffle,
    cycleRepeatMode,
  }
}
