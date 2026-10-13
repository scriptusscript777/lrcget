<template>
  <BaseModal title="Update available" content-class="w-full max-w-md" @close="emit('later')">
    <div class="text-sm text-neutral-800 dark:text-neutral-300 flex flex-col gap-3">
      <div class="flex gap-2 items-start font-bold text-yellow-600">
        <Alert class="text-lg flex-none" />
        <span>LRCGET {{ latestVersion }} has been published on GitHub.</span>
      </div>
      <div>
        You have version <span class="font-bold">{{ currentVersion }}</span
        >. Your music library, lyrics and settings are kept when you install the update.
      </div>
      <div v-if="assetName">
        Download: <span class="font-bold">{{ installerLabel }}</span>
        <div class="text-xs text-neutral-500 break-all">{{ assetName }}</div>
      </div>
      <div v-if="assetName && steps.length">
        <div class="font-bold mb-1">After downloading:</div>
        <ol class="list-decimal pl-5 flex flex-col gap-1">
          <li v-for="step in steps" :key="step.text">
            {{ step.text }}
            <code
              v-if="step.command"
              class="block mt-1 px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 break-all select-text"
              >{{ step.command }}</code
            >
          </li>
        </ol>
      </div>
      <a :href="releaseUrl" class="link" @click.prevent="emit('open-release')">
        See what's new: {{ releaseName }}
      </a>
    </div>

    <template #footer>
      <div class="w-full flex flex-wrap justify-end gap-2">
        <button class="button button-normal px-4 h-8 rounded-full text-sm" @click="emit('skip')">
          Skip this version
        </button>
        <button class="button button-normal px-4 h-8 rounded-full text-sm" @click="emit('later')">
          Later
        </button>
        <button
          class="button px-4 h-8 rounded-full text-sm bg-hoa-1500 text-white hover:bg-hoa-1400 dark:bg-hoa-1500 dark:text-white dark:hover:bg-hoa-1400"
          @click="emit('download')"
        >
          {{ assetName ? 'Download update' : 'Open release page' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { computed } from 'vue'
import Alert from '~icons/mdi/alert'
import BaseModal from '@/components/common/BaseModal.vue'
import { INSTALLER_LABELS } from '@/utils/update-check.js'

const props = defineProps({
  currentVersion: { type: String, required: true },
  latestVersion: { type: String, required: true },
  releaseName: { type: String, required: true },
  releaseUrl: { type: String, required: true },
  installKind: { type: String, default: 'other' },
  assetName: { type: String, default: null },
})

const emit = defineEmits(['download', 'open-release', 'later', 'skip'])

const installerLabel = computed(() => INSTALLER_LABELS[props.installKind] ?? props.assetName)

// LRCGET never runs a downloaded installer; these steps guide the user.
const steps = computed(() => {
  const file = props.assetName
  switch (props.installKind) {
    case 'deb':
      return [
        { text: 'Close LRCGET.' },
        {
          text: 'Open a terminal in the download folder and run:',
          command: `sudo apt install ./${file}`,
        },
        { text: 'Start LRCGET. The installed copy is upgraded in place.' },
      ]
    case 'appimage':
      return [
        { text: 'Close LRCGET.' },
        {
          text: 'Allow the new file to run (Properties, Permissions, "Allow executing"), or run:',
          command: `chmod +x ${file}`,
        },
        { text: 'Replace your old AppImage with the new file, then start it.' },
      ]
    case 'msi':
      return [
        { text: 'Close LRCGET.' },
        { text: `Double-click ${file}. It replaces the installed version.` },
        {
          text: 'If Windows shows "Windows protected your PC", choose More info, then Run anyway. The installer is not code-signed.',
        },
      ]
    default:
      return []
  }
})
</script>
