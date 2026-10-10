<template>
  <div
    class="library-track-columns w-full group hover:bg-neutral-50 hover:shadow hover:shadow-neutral-100/50 border hover:border-neutral-100 transition rounded cursor-default dark:hover:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:shadow-black/50"
    :class="{
      'border-neutral-100 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900': isPlaying,
      'border-transparent': !isPlaying,
      'with-track-number': isShowTrackNumber,
    }"
  >
    <!-- Track number -->
    <div
      v-if="isShowTrackNumber"
      class="flex-none flex items-center justify-end p-1 pr-2 text-xs text-neutral-800/70 dark:text-neutral-200 font-bold"
    >
      <div v-if="track && track.track_number">
        {{ track.track_number }}
      </div>
      <div v-else>--</div>
    </div>

    <!-- Track title, album, and artist -->
    <div class="flex-none flex min-w-0 overflow-hidden p-1" @click="playTrack(track)">
      <div v-if="track" class="min-w-0">
        <div class="font-bold text-sm text-neutral-800 flex items-center dark:text-neutral-200">
          <Equalizer v-if="isPlaying && status === 'playing' && !editingAudioSource" class="mr-1" />
          <span class="truncate" :title="track.title">{{ track.title }}</span>
        </div>

        <div class="gap-2 line-clamp-1">
          <span
            class="text-sm text-neutral-500 transition dark:text-neutral-400 cursor-pointer hover:underline"
            @click.stop="goToAlbum"
            >{{ track.album_name }}</span
          >
          <span class="text-neutral-500 h-full mx-1 flex-none dark:text-neutral-400">·</span>
          <span
            class="text-sm text-neutral-500 transition dark:text-neutral-400 cursor-pointer hover:underline"
            @click.stop="goToArtist"
            >{{ track.artist_name }}</span
          >
        </div>
      </div>
    </div>

    <!-- Duration -->
    <div class="flex-none flex items-center justify-end p-1" @click="playTrack(track)">
      <div v-if="track" class="text-neutral-800 font-bold text-xs text-right dark:text-neutral-400">
        {{ humanDuration(track.duration) }}
      </div>
    </div>

    <!-- Lyrics indication -->
    <div class="flex-none flex items-center justify-center p-1" @click="playTrack(track)">
      <div v-if="track">
        <span
          v-if="lyricsStatus === 'instrumental'"
          class="text-gray-200 font-bold text-[0.67rem] bg-gray-500 rounded px-1 py-0.5"
          >Instrumental</span
        >
        <span
          v-else-if="lyricsStatus === 'synced'"
          class="text-green-200 font-bold text-[0.67rem] bg-green-800 rounded px-1 py-0.5"
          >Synced</span
        >
        <span
          v-else-if="lyricsStatus === 'plain'"
          class="text-gray-200 font-bold text-[0.67rem] bg-gray-800 rounded px-1 py-0.5"
          >Plain</span
        >
      </div>
    </div>

    <!-- Scan/import dates are not edit dates; unknown historical edits remain blank. -->
    <div
      class="flex-none flex items-center justify-center p-1 text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
      data-testid="track-modified"
    >
      <time
        v-if="modifiedTime"
        :datetime="track.lyrics_modified_at"
        :title="modifiedTime.description"
      >
        <span class="text-green-200 font-bold text-[0.67rem] bg-green-800 rounded px-1 py-0.5"
          >Modified</span
        >
        <span class="block mt-1 whitespace-nowrap text-[11px]"
          >{{ modifiedTime.date }} {{ modifiedTime.time }}</span
        >
      </time>
      <span v-else title="No recorded lyric save in LRCGET">--</span>
    </div>

    <!-- Action buttons -->
    <div class="flex-none h-full flex justify-end items-center p-1">
      <div v-if="track" class="flex justify-end items-center gap-1">
        <button v-if="isPlaying && status === 'playing'" class="track-button" @click="pause">
          <Pause />
        </button>
        <button
          v-else-if="isPlaying && status === 'stopped'"
          class="track-button"
          @click="playTrack(track)"
        >
          <Replay />
        </button>
        <button v-else class="track-button" @click="isPlaying ? resume() : playTrack(track)">
          <Play />
        </button>
        <button class="track-button" @click="searchLyrics(track)">
          <TextSearch />
        </button>
        <button class="track-button" @click="openEditLyricsV2(track)">
          <PlaylistEdit />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Play from '~icons/mdi/play'
import Pause from '~icons/mdi/pause'
import TextSearch from '~icons/mdi/text-search'
import PlaylistEdit from '~icons/mdi/playlist-edit'
import Replay from '~icons/mdi/replay'
import { humanDuration } from '../../../utils/human-duration.js'
import { lyricsModifiedTime } from '@/utils/lyrics-modified-time.js'
import { useSearchLyrics } from '../../../composables/search-lyrics.js'
import { useEditLyricsV2 } from '../../../composables/edit-lyrics-v2.js'
import Equalizer from '@/components/icons/Equalizer.vue'
import { parseLyricsfile } from '@/utils/lyricsfile.js'
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { usePlayer } from '@/composables/player.js'
import { useLibraryNavigation } from '@/composables/library-navigation.js'

const { playTrack, playingTrack, status, pause, resume } = usePlayer()
const { navigateToAlbum, navigateToArtist } = useLibraryNavigation()

const goToAlbum = () => {
  if (track.value?.album_id) {
    navigateToAlbum(track.value.album_id)
  }
}

const goToArtist = () => {
  if (track.value?.artist_id) {
    navigateToArtist(track.value.artist_id)
  }
}

const { searchLyrics } = useSearchLyrics()
const { editLyricsV2, editingAudioSource } = useEditLyricsV2()
const props = defineProps(['trackId', 'isShowTrackNumber'])
const track = ref(null)
const modifiedTime = computed(() => lyricsModifiedTime(track.value?.lyrics_modified_at))

const isPlaying = computed(() => {
  return playingTrack.value && track.value && playingTrack.value.id === track.value.id
})

const lyricsStatus = computed(() => {
  if (!track.value) {
    return null
  }
  if (track.value.instrumental) {
    return 'instrumental'
  }
  if (!track.value.lyricsfile) {
    return null
  }
  const parsed = parseLyricsfile(track.value.lyricsfile)
  if (parsed.syncedLines && parsed.syncedLines.length > 0) {
    return 'synced'
  }
  if (parsed.plainLyrics && parsed.plainLyrics.length > 0) {
    return 'plain'
  }
  return null
})

const openEditLyricsV2 = track => {
  const audioSource = {
    type: 'library',
    id: track.id,
    file_path: track.file_path,
    duration: track.duration,
    title: track.title,
    artist_name: track.artist_name,
    album_name: track.album_name,
  }
  const lyricsfile = {
    id: track.lyricsfile_id ?? null, // Use the lyricsfile ID from the database (null if no lyricsfile exists)
    content: track.lyricsfile ?? '',
  }
  // Pass trackId for library tracks - this tells the save function to associate the lyricsfile with this track
  editLyricsV2({ audioSource, lyricsfile, trackId: track.id })
}

let unlisten = null
let disposed = false
let loadOperation = 0

const loadTrack = async id => {
  const operation = ++loadOperation
  const result = await invoke('get_track', { trackId: id })
  // Virtual rows can change identity while a date/content reload is still pending.
  if (!disposed && operation === loadOperation && id === props.trackId) track.value = result
}

watch(
  () => props.trackId,
  async newId => {
    track.value = null
    loadOperation++
    if (newId) {
      await loadTrack(newId)
    }
  }
)

onMounted(async () => {
  await loadTrack(props.trackId)
  if (disposed) return

  const stopListening = await listen('reload-track-id', async event => {
    const payload = event.payload
    if (props.trackId === payload) {
      await loadTrack(props.trackId)
    }
  })
  if (disposed) stopListening()
  else unlisten = stopListening
})

onUnmounted(() => {
  disposed = true
  loadOperation++
  if (unlisten) {
    unlisten()
  }
})
</script>

<style scoped>
.track-button {
  @apply text-neutral-800 hover:bg-hoa-1100 hover:text-white rounded p-2 transition dark:text-white dark:hover:bg-hoa-1100;
}
</style>
