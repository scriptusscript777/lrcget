<template>
  <div
    v-if="drafts.length"
    class="min-w-0 shrink-0 flex flex-wrap items-center gap-2 bg-amber-100 pl-10 pr-3 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-yellow-300"
    role="status"
  >
    <span class="min-w-0 max-w-full break-words"
      >Unfinished lyrics: {{ current?.source?.audioSource?.title || 'lyrics draft'
      }}{{ drafts.length > 1 ? ` (+${drafts.length - 1} more)` : '' }}</span
    >
    <button
      v-if="current?.source?.trackId != null"
      class="button button-normal rounded px-2 py-1"
      :disabled="resuming"
      @click="resume"
    >
      Resume editing
    </button>
    <span v-else>Reopen this lyrics item to recover your edits.</span>
    <span v-if="error">{{ error }}</span>
  </div>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listRecovery, RECOVERY_EVENT, recoveryTarget } from '@/utils/editor-recovery.js'
import { useEditLyricsV2 } from '@/composables/edit-lyrics-v2.js'
const drafts = ref([])
const current = computed(() => drafts.value[0])
const resuming = ref(false)
const error = ref('')
const { editLyricsV2, editingAudioSource } = useEditLyricsV2()
const refresh = () => {
  drafts.value = listRecovery()
}
const resume = async () => {
  if (resuming.value || editingAudioSource.value) return
  const record = current.value
  if (record?.source?.trackId == null) return
  resuming.value = true
  error.value = ''
  try {
    const track = await invoke('get_track', { trackId: record.source.trackId })
    const audioSource = {
      type: 'library',
      id: track.id,
      file_path: track.file_path,
      title: track.title,
      artist_name: track.artist_name,
      album_name: track.album_name,
      duration: track.duration,
    }
    const lyricsfile = { id: track.lyricsfile_id ?? null, content: track.lyricsfile ?? '' }
    if (recoveryTarget(audioSource, lyricsfile, track.id) !== record.target)
      throw new Error(
        'This song changed or is no longer in the library. The recovery draft has been kept.'
      )
    editLyricsV2({ audioSource, lyricsfile, trackId: track.id })
  } catch (err) {
    error.value = String(err.message || err)
  } finally {
    resuming.value = false
  }
}
onMounted(() => {
  refresh()
  window.addEventListener(RECOVERY_EVENT, refresh)
  window.addEventListener('storage', refresh)
})
onUnmounted(() => {
  window.removeEventListener(RECOVERY_EVENT, refresh)
  window.removeEventListener('storage', refresh)
})
</script>
