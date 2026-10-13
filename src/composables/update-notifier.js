import { useModal, useVfm } from 'vue-final-modal'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import UpdateAvailable from '@/components/UpdateAvailable.vue'
import { fetchLatestRelease, isNewerRelease, pickInstallerAsset } from '@/utils/update-check.js'

const FIRST_CHECK_DELAY_MS = 5000
const BUSY_RETRY_MS = 60 * 1000
const SKIPPED_VERSION_KEY = 'lrcget.update.skippedVersion'

// Storage is a convenience: without it a skipped version is offered again.
const readStored = key => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignored; see readStored.
  }
}

// Must be called from a component setup function (it registers a modal).
export function useUpdateNotifier() {
  const vfm = useVfm()
  let pending = null
  let retryTimer = null

  const modal = useModal({ component: UpdateAvailable })

  const openUrl = url => open(url).catch(error => console.error(error))

  const show = () => {
    if (!pending) return
    // Never interrupt an editor or another dialog; try again shortly.
    if (vfm.openedModals.length > 0) {
      clearTimeout(retryTimer)
      retryTimer = setTimeout(show, BUSY_RETRY_MS)
      return
    }
    const { release, currentVersion, installKind, asset } = pending
    pending = null
    modal.patchOptions({
      attrs: {
        currentVersion,
        latestVersion: release.version,
        releaseName: release.name,
        releaseUrl: release.releaseUrl,
        installKind: installKind.kind,
        assetName: asset?.name ?? null,
        onDownload() {
          openUrl(asset?.url || release.releaseUrl)
          modal.close()
        },
        onOpenRelease() {
          openUrl(release.releaseUrl)
        },
        onLater() {
          modal.close()
        },
        onSkip() {
          writeStored(SKIPPED_VERSION_KEY, release.version)
          modal.close()
        },
      },
    })
    modal.open()
  }

  const announce = (release, currentVersion, installKind) => {
    const asset = pickInstallerAsset(release.assets, installKind)
    // LRCGET is a desktop app for Linux x64 (.deb/AppImage) and Windows x64
    // (.msi). Other systems have no matching installer, so they get no alert.
    if (!asset) return
    pending = { release, currentVersion, installKind, asset }
    show()
  }

  const checkForUpdate = async () => {
    try {
      const [currentVersion, installKind, release] = await Promise.all([
        getVersion(),
        invoke('get_install_kind'),
        fetchLatestRelease(),
      ])
      if (!isNewerRelease(release.tag, currentVersion)) return
      if (release.version === readStored(SKIPPED_VERSION_KEY)) return
      announce(release, currentVersion, installKind)
    } catch (error) {
      // Offline or rate-limited: stay quiet; the next app start checks again.
      console.warn('Update check failed:', error)
    }
  }

  // One check per app start, shortly after the library appears.
  const start = () => {
    setTimeout(checkForUpdate, FIRST_CHECK_DELAY_MS)
    if (import.meta.env.DEV) {
      // Development-only hooks for documentation screenshots and testing.
      window.__lrcgetCheckForUpdate = checkForUpdate
      window.__lrcgetPreviewUpdate = async (release = {}, kind = null) => {
        const currentVersion = await getVersion()
        const detected = await invoke('get_install_kind')
        const installKind = kind ? { ...detected, kind } : detected
        announce(
          {
            tag: 'v9.9.9',
            version: '9.9.9',
            name: 'LRCGET 9.9.9 (preview)',
            releaseUrl: 'https://github.com/scriptusscript777/lrcget/releases',
            assets: [
              { name: 'LRCGET_9.9.9_amd64.deb', url: '' },
              { name: 'LRCGET_9.9.9_amd64.AppImage', url: '' },
              { name: 'LRCGET_9.9.9_x64_en-US.msi', url: '' },
            ],
            ...release,
          },
          currentVersion,
          installKind
        )
      }
    }
  }

  return { start, checkForUpdate }
}
