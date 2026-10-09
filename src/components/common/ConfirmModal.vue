<template>
  <BaseModal :title="title" content-class="w-full max-w-sm" :close-button="false">
    <p class="text-neutral-800 dark:text-neutral-300">{{ message }}</p>

    <template #footer>
      <div class="w-full flex justify-end gap-2">
        <button class="button button-normal px-4 h-8 rounded-full text-sm" @click="emit('cancel')">
          {{ cancelText }}
        </button>
        <button
          class="button px-4 h-8 rounded-full text-sm bg-hoa-1500 text-white hover:bg-hoa-1400 dark:bg-hoa-1500 dark:text-white dark:hover:bg-hoa-1400"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import BaseModal from '@/components/common/BaseModal.vue'

defineProps({
  title: {
    type: String,
    default: 'Unsaved Changes',
  },
  message: {
    type: String,
    default: 'You have unsaved changes. Are you sure you want to close?',
  },
  confirmText: {
    type: String,
    default: 'Discard Changes',
  },
  cancelText: {
    type: String,
    default: 'Cancel',
  },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>
