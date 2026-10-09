import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEditLyricsV2SyncedHotkeys } from './useEditLyricsV2SyncedHotkeys.js'

vi.mock('./shortcutRegistry.js', () => ({
  wordTimingShortcutBindings: [],
  syncedEditorShortcutBindings: [
    'syncLineEndAndAdvance',
    'syncLineAndAdvance',
    'syncLineAndAdvanceNoPreviousEndSync',
  ].map(id => ({ id, matches: event => event.key === id })),
}))
afterEach(() => vi.unstubAllGlobals())

it.each(['syncLineEndAndAdvance', 'syncLineAndAdvance', 'syncLineAndAdvanceNoPreviousEndSync'])(
  '%s does not advance after a rejected timing change',
  key => {
    vi.stubGlobal('HTMLElement', class {})
    let listener
    vi.stubGlobal('document', {
      addEventListener: (_name, callback) => {
        listener = callback
      },
    })
    const selectSyncedLine = vi.fn()
    const controls = useEditLyricsV2SyncedHotkeys({
      activeTab: ref('synced'),
      isSyncedLineEditing: ref(false),
      selectedLineExists: ref(true),
      selectedSyncedLineIndex: ref(0),
      selectedSyncedLineIndices: ref([]),
      syncedLines: ref([
        { start_ms: 1000, end_ms: 3000 },
        { start_ms: 4000, end_ms: 5000 },
      ]),
      progressMs: ref(500),
      selectSyncedLine,
      syncLineToCurrentProgress: vi.fn(() => false),
      syncEndToCurrentProgress: vi.fn(() => false),
    })
    controls.bindSyncedHotkeys()
    listener({ key, target: null, preventDefault: vi.fn() })
    expect(selectSyncedLine).not.toHaveBeenCalled()
  }
)
