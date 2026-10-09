import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEditLyricsV2WordTimingHotkeys } from './useEditLyricsV2WordTimingHotkeys.js'
import { useEditLyricsV2SyncedHotkeys } from './useEditLyricsV2SyncedHotkeys.js'
import { resetAllShortcutOverrides, setShortcutOverride } from './shortcutRegistry.js'

afterEach(() => {
  resetAllShortcutOverrides()
  vi.unstubAllGlobals()
})

describe('optional word timing keyboard scope', () => {
  it('routes Delete to words only when expanded and cleans up hidden word shortcuts', () => {
    setShortcutOverride('deleteSelectedLine', ['Delete'])
    const listeners = { document: new Set(), window: new Set() }
    for (const owner of ['document', 'window'])
      vi.stubGlobal(owner, {
        addEventListener: (_, handler) => listeners[owner].add(handler),
        removeEventListener: (_, handler) => listeners[owner].delete(handler),
      })
    vi.stubGlobal('HTMLElement', class {})
    const expanded = ref(true)
    const deleteLine = vi.fn()
    const deleteWords = vi.fn()
    const syncWord = vi.fn()
    const synced = useEditLyricsV2SyncedHotkeys({
      wordTimingExpanded: expanded,
      activeTab: ref('synced'),
      isSyncedLineEditing: ref(false),
      selectedLineExists: ref(true),
      selectedSyncedLineIndex: ref(0),
      selectedSyncedLineIndices: ref([]),
      deleteSyncedLine: deleteLine,
    })
    const word = useEditLyricsV2WordTimingHotkeys({
      isWordSyncAvailable: expanded,
      deleteSelectedBoundaries: deleteWords,
      syncSelectedBoundaryAtProgress: syncWord,
    })
    synced.bindSyncedHotkeys()
    word.bindWordTimingHotkeys()
    const send = (key, extra = {}) => {
      const event = {
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: { tagName: 'BUTTON' },
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true
        },
        ...extra,
      }
      listeners.document.forEach(handler => handler(event))
      listeners.window.forEach(handler => handler(event))
    }
    send('Delete')
    expect(deleteWords).toHaveBeenCalledOnce()
    expect(deleteLine).not.toHaveBeenCalled()
    send('z')
    expect(syncWord).toHaveBeenCalledOnce()
    send('z', { defaultPrevented: true })
    expect(syncWord).toHaveBeenCalledOnce()
    expanded.value = false
    word.unbindWordTimingHotkeys()
    send('z')
    expect(syncWord).toHaveBeenCalledOnce()
    send('Delete')
    expect(deleteLine).toHaveBeenCalledOnce()
    expect(deleteWords).toHaveBeenCalledOnce()
    synced.unbindSyncedHotkeys()
    expect(listeners.window.size).toBe(0)
    expect(listeners.document.size).toBe(0)
  })
})
