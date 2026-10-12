<template>
  <BaseModal
    title="Configuration"
    body-class="flex flex-col h-full justify-between overflow-y-auto"
    @before-open="beforeOpenHandler"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-8">
      <div>
        <label class="group-label mb-4">Common</label>

        <div class="flex flex-col mb-4">
          <label class="block mb-2 child-label">Download lyrics for:</label>

          <RadioButton
            id="download-lyrics-for-all"
            v-model="downloadLyricsFor"
            class="mb-1"
            name="download-lyrics-for"
            value="all"
          >
            All tracks (overwrite existing lyrics)
          </RadioButton>

          <RadioButton
            id="skip-synced"
            v-model="downloadLyricsFor"
            class="mb-1"
            name="download-lyrics-for"
            value="skipSynced"
          >
            Only tracks without synced lyrics
          </RadioButton>

          <RadioButton
            id="skip-plain"
            v-model="downloadLyricsFor"
            class="mb-1"
            name="download-lyrics-for"
            value="skipPlain"
          >
            Only tracks without any lyrics
          </RadioButton>
        </div>

        <!-- Total lines number should always show in search result, this configuration is not necessary -->
        <!-- <div class="flex flex-col mb-4">
          <label class="block mb-2 child-label">Search settings</label>

          <CheckboxButton id="show-line-count" v-model="showLineCount" name="show-line-count">
            Show the number of lines a lyric file has in the search menu
          </CheckboxButton>
        </div> -->

        <div class="flex flex-col mb-4">
          <label class="block mb-2 child-label">Theme mode</label>

          <div class="flex gap-4">
            <RadioButton id="theme-auto" v-model="editingThemeMode" name="theme-mode" value="auto">
              Auto
            </RadioButton>

            <RadioButton
              id="theme-light"
              v-model="editingThemeMode"
              name="theme-mode"
              value="light"
            >
              Light
            </RadioButton>

            <RadioButton id="theme-dark" v-model="editingThemeMode" name="theme-mode" value="dark">
              Dark
            </RadioButton>
          </div>
        </div>

        <div class="flex flex-col mb-4">
          <label
            for="show-hover-help"
            class="inline-flex cursor-pointer items-center gap-2 child-label"
          >
            <input
              id="show-hover-help"
              v-model="editingShowHoverHelp"
              type="checkbox"
              class="h-4 w-4 accent-hoa-1500"
              aria-describedby="hover-help-instructions"
              :disabled="isSaving || !isConfigLoaded"
            />
            Show hover help
          </label>
          <span
            id="hover-help-instructions"
            class="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
            >Off by default. F1 shows help for a hovered or focused control.</span
          >
        </div>

        <div class="flex flex-col mb-4">
          <label
            for="prevent-lyric-overlaps"
            class="inline-flex cursor-pointer items-center gap-2 child-label"
          >
            <input
              id="prevent-lyric-overlaps"
              v-model="editingPreventOverlaps"
              type="checkbox"
              class="h-4 w-4 accent-green-600"
              aria-describedby="overlap-instructions"
              :disabled="isSaving || !isConfigLoaded"
            />
            <span :class="editingPreventOverlaps ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'">Prevent overlapping lyrics</span>
          </label>
          <span
            id="overlap-instructions"
            class="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
            >On by default. Turn off to allow intentional timing overlaps.</span
          >
        </div>

        <div class="flex flex-col">
          <label class="block mb-2 child-label" for="lrclib-instance">LRCLIB instance</label>
          <input
            id="lrclib-instance"
            v-model="editingLrclibInstance"
            type="text"
            placeholder="https://"
            class="input px-4 h-8"
          />
        </div>
      </div>

      <div>
        <label class="group-label mb-4">Embedded lyrics</label>

        <div class="flex items-start">
          <CheckboxButton id="try-embed-lyrics" v-model="tryEmbedLyrics" name="try-embed-lyrics">
            <div class="flex flex-col">
              <span class="mb-0.5">Enable embedded lyrics</span>
              <span class="text-xs text-neutral-600 dark:text-neutral-400"
                >MP3 uses ID3v2.4 USLT and SYLT. Select Word-timed lyrics with Embed into track to
                include ELRC text and word timestamps. FLAC stores lyric comments.</span
              >
            </div>
          </CheckboxButton>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <a href="#" class="link hidden" @click="refreshLibrary"
          >Scan for new and modified tracks...</a
        >
        <a href="#" class="link" @click="fullScanLibrary">Reset library and perform full scan...</a>
        <a href="#" class="link" @click="manageDirectories"
          >Add and remove scanning directories...</a
        >
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col items-center gap-2">
        <p v-if="saveError" role="alert" class="text-sm text-red-700 dark:text-red-300">
          {{ saveError }}
        </p>
        <button
          class="button button-primary px-8 py-2 rounded-full disabled:opacity-50"
          :disabled="isSaving || !isConfigLoaded"
          :aria-busy="isSaving"
          @click="save"
        >
          {{ isSaving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { invoke } from '@tauri-apps/api/core'
import { ref, watch } from 'vue'
import { useGlobalState } from '../../composables/global-state'
import { usePlayer } from '@/composables/player.js'
import RadioButton from '@/components/common/RadioButton.vue'
import CheckboxButton from '@/components/common/CheckboxButton.vue'

const { setThemeMode, setLrclibInstance, setShowHoverHelp, setPreventOverlaps } = useGlobalState()
const { volume } = usePlayer()

const emit = defineEmits(['close', 'refreshLibrary', 'fullScanLibrary', 'manageDirectories'])

const downloadLyricsFor = ref('all')
const skipTracksWithSyncedLyrics = ref(true)
const skipTracksWithPlainLyrics = ref(false)
const showLineCount = ref(true)
const tryEmbedLyrics = ref(false)
const editingThemeMode = ref('auto')
const editingShowHoverHelp = ref(false)
const editingPreventOverlaps = ref(true)
const editingLrclibInstance = ref('')
const isSaving = ref(false)
const isConfigLoaded = ref(false)
const saveError = ref('')

const save = async () => {
  if (isSaving.value || !isConfigLoaded.value) return
  isSaving.value = true
  saveError.value = ''
  const submitted = {
    skipTracksWithSyncedLyrics: skipTracksWithSyncedLyrics.value,
    skipTracksWithPlainLyrics: skipTracksWithPlainLyrics.value,
    showLineCount: showLineCount.value,
    tryEmbedLyrics: tryEmbedLyrics.value,
    themeMode: editingThemeMode.value,
    lrclibInstance: editingLrclibInstance.value,
    volume: volume.value,
    showHoverHelp: editingShowHoverHelp.value,
    preventLyricOverlaps: editingPreventOverlaps.value,
  }
  try {
    await invoke('set_config', submitted)
    setShowHoverHelp(submitted.showHoverHelp)
    setPreventOverlaps(submitted.preventLyricOverlaps)
    setThemeMode(submitted.themeMode)
    setLrclibInstance(submitted.lrclibInstance)
    emit('close')
  } catch {
    saveError.value = 'Could not save configuration. Please try again.'
  } finally {
    isSaving.value = false
  }
}

const refreshLibrary = () => {
  emit('refreshLibrary')
  emit('close')
}

const fullScanLibrary = () => {
  emit('fullScanLibrary')
  emit('close')
}

const manageDirectories = () => {
  emit('manageDirectories')
  emit('close')
}

const beforeOpenHandler = async () => {
  saveError.value = ''
  isConfigLoaded.value = false
  let config
  try {
    config = await invoke('get_config')
  } catch {
    saveError.value = 'Could not load configuration. Close and reopen Settings to retry.'
    return
  }
  skipTracksWithSyncedLyrics.value = config.skip_tracks_with_synced_lyrics
  skipTracksWithPlainLyrics.value = config.skip_tracks_with_plain_lyrics

  console.log(skipTracksWithSyncedLyrics.value, skipTracksWithPlainLyrics.value)

  if (skipTracksWithSyncedLyrics.value && !skipTracksWithPlainLyrics.value) {
    downloadLyricsFor.value = 'skipSynced'
  } else if (skipTracksWithPlainLyrics.value) {
    downloadLyricsFor.value = 'skipPlain'
  } else {
    downloadLyricsFor.value = 'all'
  }

  showLineCount.value = config.show_line_count
  tryEmbedLyrics.value = config.try_embed_lyrics
  editingShowHoverHelp.value = config.show_hover_help === true
  editingPreventOverlaps.value = config.prevent_lyric_overlaps !== false
  editingThemeMode.value = config.theme_mode
  editingLrclibInstance.value = config.lrclib_instance
  isConfigLoaded.value = true
}

watch(downloadLyricsFor, newVal => {
  if (newVal === 'skipSynced') {
    skipTracksWithSyncedLyrics.value = true
    skipTracksWithPlainLyrics.value = false
  } else if (newVal === 'skipPlain') {
    skipTracksWithSyncedLyrics.value = true
    skipTracksWithPlainLyrics.value = true
  } else {
    skipTracksWithSyncedLyrics.value = false
    skipTracksWithPlainLyrics.value = false
  }
})
</script>
