<template>
  <BaseModal
    title="Master reset — current lyrics project"
    content-class="w-full max-w-lg"
    :click-to-close="false"
    :esc-to-close="false"
    @close="emit('cancel')"
    @keydown.stop
  >
    <fieldset class="flex flex-col gap-3 text-sm text-neutral-800 dark:text-neutral-200">
      <legend class="mb-3">Choose how to restart this song:</legend>
      <label class="flex items-start gap-2">
        <input
          v-model="mode"
          type="radio"
          value="saved"
          name="lyrics-project-reset"
          class="mt-1 accent-hoa-1500"
        />
        <span
          >Return to last saved lyrics<small class="block text-neutral-600 dark:text-neutral-400"
            >Discard unfinished edits and this song's recovery draft.</small
          ></span
        >
      </label>
      <label class="flex items-start gap-2">
        <input
          v-model="mode"
          type="radio"
          value="timing"
          name="lyrics-project-reset"
          class="mt-1 accent-hoa-1500"
        />
        <span
          >Clear all timing, keep lyrics text<small
            class="block text-neutral-600 dark:text-neutral-400"
            >Start sentence and word syncing again from the beginning.</small
          ></span
        >
      </label>
    </fieldset>
    <p class="mt-4 rounded bg-neutral-900 p-3 text-sm text-yellow-300" role="alert">
      {{
        mode === 'saved'
          ? 'Warning: continuing discards unfinished edits and reloads the last saved lyrics for this song.'
          : 'Warning: continuing clears all sentence and word timestamps for this song. Its current lyrics text is kept.'
      }}
      Undo history will be cleared. Other songs and music files are unaffected. Existing lyric files
      change only when you Save/export afterward.
    </p>
    <p v-if="error" class="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{{ error }}</p>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <button class="button button-normal h-8 rounded-full px-4 text-sm" @click="emit('cancel')">
          Cancel
        </button>
        <button
          class="button button-primary h-8 rounded-full px-4 text-sm disabled:opacity-40"
          :disabled="submitting"
          @click="confirm"
        >
          Continue and reset
        </button>
      </div>
    </template>
  </BaseModal>
</template>
<script setup>
import { ref } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
const emit = defineEmits(['cancel', 'reset'])
const mode = ref('saved')
const submitting = ref(false)
const error = ref('')
const confirm = () => {
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  emit('reset', {
    mode: mode.value,
    onResult: (success, message) => {
      if (!success) {
        submitting.value = false
        error.value = message ||
          'Reset could not finish. Your current work has been kept; close this dialog and review the recovery error.'
      }
    },
  })
}
</script>
