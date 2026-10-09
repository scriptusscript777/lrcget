import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'

export function useEditLyricsV2Export({ audioSource, saveLyrics, serializedLyricsfile, toast }) {
  const isExporting = ref(false)

  const exportLyrics = async ({ plainText, syncedLrc, embedIntoTrack }) => {
    if (isExporting.value) return false
    const formats = []

    if (plainText) {
      formats.push('txt')
    }

    if (syncedLrc) {
      formats.push('lrc')
    }

    if (embedIntoTrack) {
      formats.push('embedded')
    }

    if (formats.length === 0) {
      toast.error('Select at least one export format.')
      return false
    }

    isExporting.value = true
    const content = serializedLyricsfile.value
    try {
      if (!await saveLyrics()) return false
      // Only library tracks can use embedIntoTrack
      const isLibraryTrack = audioSource.value?.type === 'library'

      const results = await invoke('export_lyrics', {
        trackId: isLibraryTrack ? audioSource.value.id : null,
        formats,
        lyricsfile: content,
      })

      const succeeded = results.filter(result => result.status.type === 'success')
      const failed = results.filter(result => result.status.type !== 'success')

      if (succeeded.length > 0 && failed.length === 0) {
        toast.success(
          succeeded.length === 1
            ? `Exported to ${succeeded[0].format} successfully.`
            : `Exported ${succeeded.length} lyrics targets successfully.`
        )
        return true
      }

      if (succeeded.length > 0) {
        toast.warning(`Export partially completed: ${failed.map(result => `${result.format}: ${result.status.message || result.status.type}`).join('; ')}`)
        return false
      }

      toast.error(failed.map(result => result.status.message || 'Unknown error').join('; '))
      return false
    } catch (error) {
      console.error(error)
      toast.error(error)
      return false
    } finally {
      isExporting.value = false
    }
  }

  return {
    exportLyrics,
    isExporting,
  }
}
