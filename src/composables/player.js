import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getPlayerQueueState, selectAdjacentTrackId, setPlayerQueue } from './player-queue.js'

const playingTrack = ref(null)
const status = ref('stopped')
const duration = ref(null)
const progress = ref(null)
const volume = ref(1.0)
const playbackSpeed = ref(1.0)
const { queue, shuffle, repeatMode } = getPlayerQueueState()
let previousPlayerStatus = 'stopped'
let suppressAutomaticAdvance = false

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
  const reachedEnd = Number.isFinite(duration.value) && Number.isFinite(progress.value) &&
    progress.value >= duration.value - 0.25
  if (endedNaturally && reachedEnd && !suppressAutomaticAdvance) {
    try {
      if (repeatMode.value === 'one' && playingTrack.value) {
        await playTrack(playingTrack.value)
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
    const nextId = selectAdjacentTrackId(queue.value, playingTrack.value.id, {
      shuffled: direction > 0 && shuffle.value,
      repeat: repeatMode.value,
      direction,
    })
    if (nextId === null) return
    const track = await invoke('get_track', { trackId: nextId })
    if (track) await playTrack(track)
  }

  const toggleShuffle = () => { shuffle.value = !shuffle.value }

  const cycleRepeatMode = () => {
    repeatMode.value = repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
  }

  return {
    playingTrack,
    status,
    duration,
    progress,
    volume,
    playbackSpeed,
    queue,
    shuffle,
    repeatMode,
    playTrack,
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
