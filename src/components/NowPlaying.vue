<template>
  <div id="player-bar">
    <LyricsViewer
      v-if="(karaokeMode || hasSyncedLyrics) && !instrumental"
      :lyricsfile="lyricsfile"
      :duration="duration"
      :progress="progress"
      :karaoke-mode="karaokeMode"
      :track-title="playingTrack?.title"
      :track-artist="playingTrack?.artist_name"
      :lrc-lyrics="karaokeLrcLyrics"
      :elrc-lyricsfile="karaokeElrcLyricsfile"
      :karaoke-notice="karaokeNotice"
      @lyrics-clicked="lyricsClicked"
      @close-karaoke="closeKaraoke"
    />
    <PlainLyricsViewer v-else-if="hasPlainLyrics && !instrumental" :lyricsfile="lyricsfile" />
    <div v-else class="border-t border-neutral-200/50 dark:border-neutral-800/50" />
    <PlayerControlBar />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import LyricsViewer from './now-playing/LyricsViewer.vue'
import PlainLyricsViewer from './now-playing/PlainLyricsViewer.vue'
import PlayerControlBar from './now-playing/PlayerControlBar.vue'
import { usePlayer } from '@/composables/player.js'
import { useGlobalState } from '@/composables/global-state.js'
import { hasPlayableTimedLyrics, parseLrcLines, parseLyricsfile } from '@/utils/lyricsfile.js'

const { isHotkey } = useGlobalState()
const {
  playingTrack,
  karaokeMode,
  karaokeLrcLyrics,
  karaokeElrcLyricsfile,
  karaokeNotice,
  status,
  duration,
  progress,
  playTrack,
  closeKaraoke,
  pause,
  resume,
  seek,
} = usePlayer()

const keydownEvent = ref(null)

const instrumental = computed(() => {
  if (!playingTrack.value) {
    return null
  }

  return playingTrack.value.instrumental
})

const lyricsfile = computed(() => {
  if (!playingTrack.value) {
    return null
  }

  return playingTrack.value.lyricsfile
})

const hasSyncedLyrics = computed(() => {
  if (!lyricsfile.value) {
    return false
  }
  const parsed = parseLyricsfile(lyricsfile.value)
  return parsed.syncedLines && parsed.syncedLines.length > 0
})

const hasKaraokeSidecarLyrics = computed(
  () =>
    parseLrcLines(karaokeLrcLyrics.value).some(line => line.text.trim()) ||
    hasPlayableTimedLyrics({ lyricsfile: karaokeElrcLyricsfile.value })
)

watch(
  [karaokeMode, hasSyncedLyrics, hasKaraokeSidecarLyrics],
  ([isOpen, hasLyrics, hasSidecar]) => {
    if (isOpen && !hasLyrics && !hasSidecar) closeKaraoke()
  }
)

const hasPlainLyrics = computed(() => {
  if (!lyricsfile.value) {
    return false
  }
  const parsed = parseLyricsfile(lyricsfile.value)
  return parsed.plainLyrics && parsed.plainLyrics.length > 0
})

const forward10 = computed(() => {
  if (!playingTrack.value) {
    return null
  }
  return Math.min(duration.value - 1, progress.value + 10)
})

const reverse10 = computed(() => {
  if (!playingTrack.value) {
    return null
  }
  return Math.max(0, progress.value - 10)
})

const lyricsClicked = line => {
  seek(line.timestamp)
}

onUnmounted(async () => {
  if (keydownEvent.value) {
    document.removeEventListener(keydownEvent.value)
  }
})

onMounted(async () => {
  keydownEvent.value = document.addEventListener('keydown', event => {
    if (!isHotkey.value) {
      // hotkey is explicitly disabled
      return
    }

    const target = event.target

    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('.v-codemirror')
    ) {
      // Do nothing if the target is an input, textarea, or CodeMirror element
      return
    }

    switch (event.code) {
      case 'Space':
      case 'Enter':
        event.preventDefault()
        if (status.value === 'playing') {
          pause()
        } else if (playingTrack.value && status.value === 'stopped') {
          playTrack(playingTrack.value)
        } else {
          resume()
        }
        break
      case 'ArrowLeft':
        event.preventDefault()
        seek(reverse10.value)
        break
      case 'ArrowRight':
        event.preventDefault()
        seek(forward10.value)
        break
      default:
        break
    }
  })
})
</script>
