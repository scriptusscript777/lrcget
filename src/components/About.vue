<template>
  <BaseModal title="About" @opened="openedHandler" @close="emit('close')">
    <div class="overflow-auto">
      <div class="mb-6">
        <label class="group-label mb-2">Update</label>

        <div class="text-sm">
          <div class="mb-1">
            Current version: <span class="font-bold">{{ version }}</span>
          </div>
          <template v-if="!isCheckingForUpdate && newestVersion">
            <div class="mb-1">
              Newest version: <span class="font-bold">{{ newestVersion }}</span>
            </div>
            <div
              v-if="isUpdateAvailable"
              class="font-bold text-yellow-600 flex flex-wrap gap-1 items-center"
            >
              <Alert class="text-lg" />
              New update is available. See what's new and download at
              <span
                ><a :href="newestReleaseUrl" class="link" target="_blank"
                  >LRCGET GitHub Release Page</a
                >!</span
              >
            </div>
            <div v-else class="font-bold text-green-600 flex flex-wrap gap-1 items-center">
              <CheckCircle class="text-lg" />
              You are using newest version ;-)
            </div>
          </template>
          <div v-else-if="!isCheckingForUpdate && !newestVersion">
            Failed to check update from GitHub.
          </div>
          <div v-else>Fetching newest version data from GitHub...</div>
        </div>
      </div>

      <div class="mb-6">
        <label class="group-label mb-2">Credits</label>

        <div class="text-sm space-y-2">
          <p>
            Original LRCGET project by
            <a
              href="https://github.com/tranxuanthang/lrcget"
              class="link"
              target="_blank"
              rel="noopener noreferrer"
              >tranxuanthang</a
            >.
          </p>
          <p>
            This independent fork is maintained and modified by
            <a
              href="https://github.com/scriptusscript777"
              class="link"
              target="_blank"
              rel="noopener noreferrer"
              >Rick Lidgett (@scriptusscript777)</a
            >.
          </p>
          <p>
            Modifications and enhancements by Rick Lidgett. The original MIT license is retained.
          </p>
        </div>
      </div>

      <div class="mb-6">
        <label class="group-label mb-2">Support the original creator</label>

        <div class="text-sm">
          <p class="mb-1">Donations through this page go to the original creator, not this fork.</p>
          <a
            href="https://github.com/sponsors/tranxuanthang"
            class="link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Sponsors for tranxuanthang
          </a>
        </div>
      </div>

      <div>
        <label class="group-label mb-2">Home page and contact</label>

        <div class="text-sm">
          <div class="mb-1">
            Github URL:
            <a href="https://github.com/tranxuanthang/lrcget" class="link" target="_blank"
              >github.com/tranxuanthang/lrcget</a
            >
          </div>

          <div>
            Email:
            <a href="mailto:hoangtudevops@protonmail.com" class="link" target="_blank"
              >hoangtudevops@protonmail.com</a
            >
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup>
import Alert from '~icons/mdi/alert'
import CheckCircle from '~icons/mdi/check-circle'
import { ref, computed } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { fetchLatestRelease, isNewerRelease } from '@/utils/update-check.js'
import BaseModal from '@/components/common/BaseModal.vue'

const emit = defineEmits(['close'])

const version = ref(null)
const newestVersion = ref(null)
const newestReleaseUrl = ref(null)
const isUpdateAvailable = computed(() => {
  if (!version.value || !newestVersion.value) {
    return false
  }
  return isNewerRelease(newestVersion.value, version.value)
})
const isCheckingForUpdate = ref(true)

const openedHandler = async () => {
  version.value = await getVersion()
  isCheckingForUpdate.value = true
  try {
    const latestRelease = await fetchLatestRelease()
    newestVersion.value = latestRelease.version
    newestReleaseUrl.value = latestRelease.releaseUrl
  } catch (error) {
    console.error(error)
  } finally {
    isCheckingForUpdate.value = false
  }
}
</script>
