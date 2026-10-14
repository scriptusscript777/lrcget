<template>
  <div id="player-bar">
    <LyricsViewer
      v-if="hasSyncedLyrics && !instrumental"
      :lyricsfile="lyricsfile"
      :duration="duration"
      :progress="progress"
      @lyrics-clicked="lyricsClicked"
    />
    <PlainLyricsViewer v-else-if="hasPlainLyrics && !instrumental" :lyricsfile="lyricsfile" />
    <div v-else class="border-t border-neutral-200/50 dark:border-neutral-800/50" />
    <div
      class="bg-neutral-50 backdrop-blur px-4 py-3 flex-none flex flex-col justify-center items-center gap-3 dark:bg-neutral-900"
    >
      <div class="w-full flex gap-1 justify-center items-center">
        <div class="flex-none w-12 text-xs text-neutral-800 dark:text-neutral-500">
          {{ humanDuration(progress) }}
        </div>
        <Seek class="grow" :duration="duration" :progress="progress" @seek="seek" />
        <div class="flex-none text-right w-12 text-xs text-neutral-800 dark:text-neutral-500">
          {{ humanDuration(duration) }}
        </div>
      </div>

      <div class="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div class="min-w-0 flex flex-col justify-center items-start gap-0.5">
          <div v-if="playingTrack">
            <div class="text-xs font-bold text-neutral-800 dark:text-neutral-200 line-clamp-1">
              {{ playingTrack.title }}
            </div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
              <span class="cursor-pointer hover:underline" @click="goToAlbum">{{ playingTrack.album_name }}</span>
              <span> · </span>
              <span class="cursor-pointer hover:underline" @click="goToArtist">{{ playingTrack.artist_name }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-center gap-0.5">
          <button
            type="button"
            class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1"
            :class="shuffle ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'"
            :aria-pressed="shuffle"
            aria-label="Toggle shuffle"
            title="Shuffle"
            @click="toggleShuffle"
          >
            <Shuffle />
          </button>
          <button
            type="button"
            class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
            aria-label="Previous track"
            title="Previous track"
            :disabled="!canPlayPrevious"
            @click="playAdjacentTrack(-1)"
          >
            <SkipPrevious />
          </button>
          <button
            class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
            @click.prevent="seek(reverse10)"
          >
            <Rewind_10 />
          </button>
          <button
            v-if="status === 'playing'"
            class="button button-primary flex h-10 w-10 flex-none items-center justify-center rounded-full p-2 text-xl text-white"
            @click.prevent="pause"
          >
            <Pause />
          </button>
          <button
            v-else-if="playingTrack && status === 'stopped'"
            class="button button-primary flex h-10 w-10 flex-none items-center justify-center rounded-full p-2 text-xl text-white"
            @click.prevent="playTrack(playingTrack)"
          >
            <Replay />
          </button>
          <button
            v-else
            class="button button-primary flex h-10 w-10 flex-none items-center justify-center rounded-full p-2 text-xl text-white"
            @click.prevent="resume"
          >
            <Play />
          </button>
          <button
            class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
            @click.prevent="seek(forward10)"
          >
            <FastForward_10 />
          </button>
          <button
            type="button"
            class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1 text-lg"
            aria-label="Next track"
            title="Next track"
            :disabled="!canPlayNext"
            @click="playAdjacentTrack(1)"
          >
            <SkipNext />
          </button>
          <button
            type="button"
            class="button button-secondary flex h-8 w-8 flex-none items-center justify-center rounded-full p-1"
            :class="repeatMode !== 'off' ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'"
            :aria-pressed="repeatMode !== 'off'"
            :aria-label="repeatLabel"
            :title="`${repeatLabel} (click to change)`"
            @click="cycleRepeatMode"
          >
            <RepeatOnce v-if="repeatMode === 'one'" />
            <Repeat v-else />
          </button>
        </div>

        <div class="min-w-0 flex items-center justify-end gap-2">
          <PlaybackSpeedControl :model-value="playbackSpeed" @update:model-value="setPlaybackSpeed" />
          <VolumeSlider :volume="volume" @set-volume="setPlayerVolume" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ref, onMounted, onUnmounted } from 'vue'
import Seek from './now-playing/Seek.vue'
import PlaybackSpeedControl from '@/components/common/PlaybackSpeedControl.vue'
import LyricsViewer from './now-playing/LyricsViewer.vue'
import PlainLyricsViewer from './now-playing/PlainLyricsViewer.vue'
import Play from '~icons/mdi/play'
import Pause from '~icons/mdi/pause'
import Replay from '~icons/mdi/replay'
import Rewind_10 from '~icons/mdi/rewind-10'
import FastForward_10 from '~icons/mdi/fast-forward-10'
import Shuffle from '~icons/mdi/shuffle'
import Repeat from '~icons/mdi/repeat'
import RepeatOnce from '~icons/mdi/repeat-once'
import SkipPrevious from '~icons/mdi/skip-previous'
import SkipNext from '~icons/mdi/skip-next'
import { usePlayer } from '@/composables/player.js'
import { useGlobalState } from '@/composables/global-state.js'
import VolumeSlider from './now-playing/VolumeSlider.vue'
import { humanDuration } from '@/utils/human-duration'
import { parseLyricsfile } from '@/utils/lyricsfile.js'
import { useLibraryNavigation } from '@/composables/library-navigation.js'

const { isHotkey } = useGlobalState()
const { navigateToAlbum, navigateToArtist } = useLibraryNavigation()

const goToAlbum = () => {
  if (playingTrack.value?.album_id) {
    navigateToAlbum(playingTrack.value.album_id)
  }
}

const goToArtist = () => {
  if (playingTrack.value?.artist_id) {
    navigateToArtist(playingTrack.value.artist_id)
  }
}
const {
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
  seek,
  setVolume: setPlayerVolume,
  setPlaybackSpeed,
  toggleShuffle,
  cycleRepeatMode,
  playAdjacentTrack,
} = usePlayer()

const repeatLabel = computed(() => {
  if (repeatMode.value === 'one') return 'Repeat one'
  if (repeatMode.value === 'all') return 'Repeat all'
  return 'Repeat off'
})

const canPlayPrevious = computed(() => {
  const index = queue.value.indexOf(playingTrack.value?.id)
  return index > 0 || (index === 0 && repeatMode.value === 'all')
})

const canPlayNext = computed(() => {
  const index = queue.value.indexOf(playingTrack.value?.id)
  if (index < 0) return false
  return (
    index < queue.value.length - 1 ||
    repeatMode.value === 'all' ||
    (shuffle.value && queue.value.length > 1)
  )
})

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
