import { createRenderer, computed, nextTick, reactive, ref, ssrContextKey } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import Editor from './EditLyricsV2.vue'
import { createSyncedLinesFromPlain } from '@/utils/lyricsfile.js'

const mocks = vi.hoisted(() => ({ document: null, modals: [], toast: {} }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ readText: vi.fn() }))
vi.mock('vue-toastification', () => ({ useToast: () => mocks.toast }))
vi.mock('vue-final-modal', () => ({
  useModal: options => {
    const modal = { ...options, open: vi.fn().mockResolvedValue(), close: vi.fn() }
    mocks.modals.push(modal)
    return modal
  },
}))
vi.mock('@/composables/global-state.js', () => ({
  useGlobalState: () => ({ disableHotkey: vi.fn(), enableHotkey: vi.fn() }),
}))
vi.mock('@/composables/player.js', () => ({ usePlayer: () => ({ progress: { value: 0 } }) }))
vi.mock('@/composables/edit-lyrics-v2/useEditLyricsV2Document.js', () => ({
  useEditLyricsV2Document: () => mocks.document,
}))
vi.mock('@/composables/edit-lyrics-v2/useWaveformPlayback.js', () => ({
  useWaveformPlayback: () => ({ initializeAudio: vi.fn() }),
}))
vi.mock('@/composables/edit-lyrics-v2/useEditLyricsV2Publish.js', () => ({
  useEditLyricsV2Publish: () => ({}),
}))
vi.mock('@/composables/edit-lyrics-v2/useEditLyricsV2Export.js', () => ({
  useEditLyricsV2Export: () => ({ isExporting: mocks.document.isExporting }),
}))
vi.mock('@/composables/edit-lyrics-v2/useEditLyricsV2Playback.js', () => ({
  useEditLyricsV2Playback: () => ({ loopEnabled: { value: false } }),
}))
vi.mock('@/composables/edit-lyrics-v2/useEditLyricsV2Hotkeys.js', () => ({
  useEditLyricsV2Hotkeys: () => ({ bindHotkeys: vi.fn(), unbindHotkeys: vi.fn() }),
}))
vi.mock('@/composables/edit-lyrics-v2/useEditLyricsV2SyncedHotkeys.js', () => ({
  useEditLyricsV2SyncedHotkeys: () => ({
    bindSyncedHotkeys: vi.fn(),
    unbindSyncedHotkeys: vi.fn(),
  }),
}))
vi.mock('@/components/common/BaseModal.vue', () => ({ default: {} }))
vi.mock('@/components/common/ConfirmModal.vue', () => ({ default: {} }))
vi.mock('@/components/library/edit-lyrics-v2/EditLyricsV2DebugModal.vue', () => ({ default: {} }))
vi.mock('@/components/library/edit-lyrics-v2/EditLyricsV2HeaderActions.vue', () => ({
  default: {},
}))
vi.mock('@/components/library/edit-lyrics-v2/EditLyricsV2PlayerBar.vue', () => ({ default: {} }))
vi.mock('@/components/library/edit-lyrics-v2/EditLyricsV2Waveform.vue', () => ({ default: {} }))
vi.mock('@/components/library/edit-lyrics-v2/PlainLyricsCodeEditor.vue', () => ({ default: {} }))
vi.mock('@/components/library/edit-lyrics-v2/SyncedLyricsEditor.vue', () => ({ default: {} }))
vi.mock('@/components/library/edit-lyrics-v2/KeyboardShortcutsModal.vue', () => ({ default: {} }))

const apps = []
beforeEach(() => {
  vi.clearAllMocks()
  mocks.modals = []
  mocks.toast = { success: vi.fn(), error: vi.fn() }
  const plainLyrics = ref('')
  const syncedLines = ref([])
  const isInstrumental = ref(false)
  mocks.document = {
    plainLyrics,
    syncedLines,
    isInstrumental,
    isSaving: ref(false),
    isExporting: ref(false),
    isDirty: ref(false),
    isSyncedLineEditing: ref(false),
    serializedLyricsfile: computed(() =>
      JSON.stringify([plainLyrics.value, syncedLines.value, isInstrumental.value])
    ),
    initializeLyrics: vi.fn(),
    ensureSelectedSyncedLine: vi.fn(),
    updatePlainLyrics: vi.fn(value => {
      plainLyrics.value = value
    }),
    updateSyncedLines: vi.fn(value => {
      syncedLines.value = value
    }),
    importSyncedLinesFromPlain: vi.fn(() => {
      syncedLines.value = createSyncedLinesFromPlain(plainLyrics.value, [])
    }),
    setInstrumental: vi.fn(value => {
      isInstrumental.value = value
    }),
  }
  open.mockResolvedValue('/lyrics.txt')
  invoke.mockResolvedValue('First line\nSecond line')
})
afterEach(() => apps.splice(0).forEach(app => app.unmount()))

function mount() {
  const props = reactive({ audioSource: { type: 'library', id: 1 }, lyricsfile: null, trackId: 1 })
  let state
  const renderer = createRenderer({
    createComment: () => ({}),
    insert: () => {},
    remove: () => {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  const app = renderer.createApp({
    setup() {
      state = Editor.setup(props, { expose: vi.fn(), emit: vi.fn() })
      return () => null
    },
  })
  app.provide(ssrContextKey, { modules: new Set() })
  app.mount({})
  apps.push(app)
  return { state, props, app, document: mocks.document, confirm: mocks.modals[0] }
}
function deferred() {
  let resolve
  const promise = new Promise(done => {
    resolve = done
  })
  return { promise, resolve }
}

describe('lyrics file import', () => {
  it('imports untimed TXT into untimed synced rows, without writes or invented timestamps', async () => {
    const { state, document } = mount()
    await state.handleImportLrcFile()
    expect(document.plainLyrics.value).toBe('First line\nSecond line')
    expect(document.updateSyncedLines).not.toHaveBeenCalled()
    expect(document.importSyncedLinesFromPlain).toHaveBeenCalledOnce()
    expect(document.syncedLines.value.map(line => line.text)).toEqual(['First line', 'Second line'])
    expect(
      document.syncedLines.value.every(line => line.start_ms == null && line.end_ms == null)
    ).toBe(true)
    expect(state.activeTab.value).toBe('synced')
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'Lyrics files', extensions: ['txt', 'lrc'] }],
      })
    )
    expect(invoke).toHaveBeenCalledExactlyOnceWith('read_text_file', { filePath: '/lyrics.txt' })
  })

  it.each(['txt', 'lrc'])(
    'imports timestamped %s into both views and selects Synced',
    async extension => {
      open.mockResolvedValue(`/lyrics.${extension}`)
      invoke.mockResolvedValue('[00:01.00]First\n[00:02.00]Second')
      const { state, document } = mount()
      await state.handleImportLrcFile()
      expect(document.plainLyrics.value).toBe('First\nSecond')
      expect(document.syncedLines.value.map(line => line.start_ms)).toEqual([1000, 2000])
      expect(state.activeTab.value).toBe('synced')
      expect(document.updateSyncedLines).toHaveBeenCalledOnce()
      expect(document.updatePlainLyrics).toHaveBeenCalledOnce()
    }
  )

  it.each([false, true])(
    'confirms replacement before any mutation (confirm=%s)',
    async confirmed => {
      const { state, document, confirm } = mount()
      document.plainLyrics.value = 'Existing plain'
      document.syncedLines.value = [{ text: 'Existing synced', start_ms: 0 }]
      invoke.mockResolvedValue('[00:01.00]Replacement')
      await state.handleImportLrcFile()
      expect(confirm.open).toHaveBeenCalledOnce()
      expect(document.updatePlainLyrics).not.toHaveBeenCalled()
      expect(document.updateSyncedLines).not.toHaveBeenCalled()
      expect(state.isImporting.value).toBe(true)
      confirm.attrs[confirmed ? 'onConfirm' : 'onCancel']()
      expect(state.isImporting.value).toBe(false)
      expect(document.plainLyrics.value).toBe(confirmed ? 'Replacement' : 'Existing plain')
      expect(document.syncedLines.value[0].text).toBe(confirmed ? 'Replacement' : 'Existing synced')
      expect(state.activeTab.value).toBe(confirmed ? 'synced' : 'plain')
    }
  )

  it.each(['plain', 'timings', 'instrumental'])(
    'confirms untimed TXT replacement of existing %s before creating fresh rows',
    async existing => {
      const { state, document, confirm } = mount()
      if (existing === 'plain') document.plainLyrics.value = 'Old plain'
      else if (existing === 'timings')
        document.syncedLines.value = [{ text: 'Old timed', start_ms: 9000 }]
      else document.isInstrumental.value = true
      await state.handleImportLrcFile()
      expect(confirm.open).toHaveBeenCalledOnce()
      expect(document.updatePlainLyrics).not.toHaveBeenCalled()
      expect(document.importSyncedLinesFromPlain).not.toHaveBeenCalled()
      expect(document.setInstrumental).not.toHaveBeenCalled()
      confirm.attrs.onConfirm()
      expect(document.plainLyrics.value).toBe('First line\nSecond line')
      expect(document.syncedLines.value.map(line => line.text)).toEqual([
        'First line',
        'Second line',
      ])
      expect(
        document.syncedLines.value.every(line => line.start_ms == null && line.end_ms == null)
      ).toBe(true)
      expect(document.isInstrumental.value).toBe(false)
      expect(state.activeTab.value).toBe('synced')
    }
  )

  it('rejects the old file chooser response before reading when the source changes', async () => {
    const { state, props, document } = mount()
    const dialog = deferred()
    open.mockReturnValue(dialog.promise)
    const request = state.handleImportLrcFile()
    props.audioSource = { type: 'library', id: 2 }
    dialog.resolve('/old.txt')
    await request
    expect(invoke).not.toHaveBeenCalled()
    expect(document.updatePlainLyrics).not.toHaveBeenCalled()
    expect(state.isImporting.value).toBe(false)
  })

  it('does not open concurrent dialogs or import while saving/exporting', async () => {
    const { state, document } = mount()
    document.isSaving.value = true
    await state.handleImportLrcFile()
    document.isSaving.value = false
    document.isExporting.value = true
    await state.handleImportLrcFile()
    expect(open).not.toHaveBeenCalled()
    document.isExporting.value = false
    const dialog = deferred()
    open.mockReturnValue(dialog.promise)
    const request = state.handleImportLrcFile()
    await state.handleImportLrcFile()
    expect(open).toHaveBeenCalledOnce()
    dialog.resolve(null)
    await request
    expect(state.isImporting.value).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
  })

  it.each([
    'source',
    'source-mutation',
    'lyricsfile',
    'track',
    'document',
    'undo-return',
    'unmount',
  ])('rejects a late file read after %s changes', async mode => {
    const { state, document, props, app } = mount()
    const read = deferred()
    invoke.mockReturnValue(read.promise)
    const request = state.handleImportLrcFile()
    await nextTick()
    if (mode === 'source') props.audioSource = { type: 'library', id: 2 }
    else if (mode === 'source-mutation') props.audioSource.id = 2
    else if (mode === 'lyricsfile') props.lyricsfile = { content: 'new session' }
    else if (mode === 'track') props.trackId = 2
    else if (mode === 'document') document.plainLyrics.value = 'New edit'
    else if (mode === 'undo-return') {
      document.plainLyrics.value = 'New edit'
      document.plainLyrics.value = ''
    } else {
      app.unmount()
      apps.pop()
    }
    read.resolve('Old lyrics')
    await request
    expect(document.updatePlainLyrics).not.toHaveBeenCalled()
    expect(document.updateSyncedLines).not.toHaveBeenCalled()
    expect(mocks.toast.success).not.toHaveBeenCalled()
  })

  it('invalidates an open replacement confirmation when lyrics change', async () => {
    const { state, document, confirm } = mount()
    document.plainLyrics.value = 'Original'
    await state.handleImportLrcFile()
    document.plainLyrics.value = 'New edit'
    confirm.attrs.onConfirm()
    expect(document.plainLyrics.value).toBe('New edit')
    expect(document.updatePlainLyrics).not.toHaveBeenCalled()
    expect(state.isImporting.value).toBe(false)
  })

  it.each(['', '[00:bad]Malformed', 'Untimed LRC'])(
    'shows errors without changing content for invalid file %s',
    async content => {
      open.mockResolvedValue('/lyrics.lrc')
      invoke.mockResolvedValue(content)
      const { state, document } = mount()
      await state.handleImportLrcFile()
      expect(mocks.toast.error).toHaveBeenCalledOnce()
      expect(document.updatePlainLyrics).not.toHaveBeenCalled()
      expect(document.updateSyncedLines).not.toHaveBeenCalled()
      expect(state.isImporting.value).toBe(false)
    }
  )

  it('handles read failures without document edits', async () => {
    invoke.mockRejectedValue(new Error('Cannot read lyrics file'))
    const { state, document } = mount()
    await state.handleImportLrcFile()
    expect(mocks.toast.error).toHaveBeenCalledWith('Error: Cannot read lyrics file')
    expect(document.updatePlainLyrics).not.toHaveBeenCalled()
    expect(state.isImporting.value).toBe(false)
  })

  it('keeps the shared header import accessible and atomic marker wiring intact', () => {
    const source = readFileSync(new URL('./EditLyricsV2.vue', import.meta.url), 'utf8')
    const header = source.split('<template #titleRight>')[1].split('</template>')[0]
    expect(header).toContain('aria-label="Import lyrics file"')
    expect(header).toContain('title="Import lyrics file"')
    expect(header).toContain(':disabled="isSaving || isExporting || isImporting"')
    expect(header).toContain('@click="handleImportLrcFile"')
    expect(source).toContain('@update-markers="updateWaveformMarkers"')
  })
})
