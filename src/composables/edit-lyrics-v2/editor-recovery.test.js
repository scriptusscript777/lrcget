import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditLyricsV2Document } from './useEditLyricsV2Document.js'
import { listRecovery, recoveryTarget, RECOVERY_PREFIX } from '@/utils/editor-recovery.js'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
function memoryStorage() {
  const data = new Map()
  return { get length() { return data.size }, key: i => [...data.keys()][i],
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
function editor(storage, content = '', id = 1) {
  const scope = effectScope()
  const state = scope.run(() => useEditLyricsV2Document({
    audioSource: ref({ type: 'library', id, title: 'Song', artist_name: 'Singer', file_path: `/music/${id}.mp3`, duration: 30 }),
    lyricsfile: ref({ id: 10, content }), trackId: ref(id), progress: ref(1),
    toast: { error: vi.fn() }, recoveryStore: storage,
  }))
  state.initializeLyrics()
  return { state, scope }
}
const lines = [{ text: 'first word', start_ms: 1000, end_ms: 3000, words: [{ text: 'first ', start_ms: 1000, end_ms: 1800 }, { text: 'word', start_ms: 1800, end_ms: 3000 }] }]
describe('durable unfinished editor work', () => {
  it('writes immediately without relying on shutdown and restores words and context', () => {
    const storage = memoryStorage()
    const first = editor(storage)
    first.state.updatePlainLyrics('plain draft')
    first.state.updateSyncedLines(lines)
    first.state.updateRecoveryContext({ activeTab: 'synced', wordTimingExpanded: true, selectedLineIndex: 0 })
    const restored = editor(storage) // simulated crash: first editor has not been disposed
    expect(restored.state.plainLyrics.value).toBe('plain draft')
    expect(restored.state.syncedLines.value[0].words).toEqual(lines[0].words)
    expect(restored.state.recoveryContext.value.wordTimingExpanded).toBe(true)
    expect(restored.state.isDirty.value).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
    first.scope.stop(); restored.scope.stop()
  })
  it('keeps songs separate and never changes unrelated storage', () => {
    const storage = memoryStorage(); storage.setItem('other-app', 'leave alone')
    const a = editor(storage); a.state.updatePlainLyrics('one')
    const b = editor(storage, '', 2); expect(b.state.plainLyrics.value).toBe('')
    b.state.updatePlainLyrics('two')
    expect(listRecovery(storage)).toHaveLength(2)
    expect(storage.getItem('other-app')).toBe('leave alone')
    a.scope.stop(); b.scope.stop()
  })
  it('cleans only this saved draft after successful Save', async () => {
    invoke.mockResolvedValue(null)
    const storage = memoryStorage(); const a = editor(storage); const b = editor(storage, '', 2)
    a.state.updatePlainLyrics('one'); b.state.updatePlainLyrics('two')
    expect(await a.state.saveLyrics()).toBe(true)
    expect(listRecovery(storage)).toHaveLength(1)
    a.scope.stop(); b.scope.stop()
    expect(listRecovery(storage)[0].source.trackId).toBe(2)
  })
  it('keeps recovery on failed Save and newer edits during Save', async () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updatePlainLyrics('before')
    invoke.mockRejectedValueOnce(new Error('disk full'))
    expect(await a.state.saveLyrics()).toBe(false)
    expect(listRecovery(storage)[0].document.plain).toBe('before')
    let complete
    invoke.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const saving = a.state.saveLyrics()
    a.state.updatePlainLyrics('newer')
    complete(null); await saving
    expect(listRecovery(storage)[0].document.plain).toBe('newer')
    expect(a.state.isDirty.value).toBe(true)
    a.scope.stop()
  })
  it('requires a choice when the saved lyrics changed elsewhere', async () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updatePlainLyrics('old working draft'); a.scope.stop()
    const b = editor(storage, 'plain: externally saved\n')
    expect(b.state.plainLyrics.value).toBe('externally saved')
    expect(b.state.recoveryConflict.value).not.toBe(null)
    expect(await b.state.saveLyrics()).toBe(false)
    b.state.restoreRecovery()
    expect(b.state.plainLyrics.value).toBe('old working draft')
    expect(listRecovery(storage)[0].baseline).toContain('externally saved')
    b.scope.stop()
  })
  it('preserves unfinished sentence typing but Cancel restores the prior draft', () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updateSyncedLines(lines)
    a.state.updatePendingSentence({ lineIndex: 0, originalText: 'first word', text: 'new words' })
    expect(listRecovery(storage)[0].document.synced[0]).toMatchObject({ text: 'new words', words: [] })
    expect(a.state.syncedLines.value[0].text).toBe('first word')
    a.state.updatePendingSentence(null)
    expect(listRecovery(storage)[0].document.synced[0].text).toBe('first word')
    a.scope.stop()
  })
  it('keeps unconfirmed markers even after the document was saved', async () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updateSyncedLines(lines)
    a.state.updateRecoveryContext({ markerPreview: { lineIndex: 0, lineText: 'first word', startMs: 1200, endMs: 3000 } })
    invoke.mockResolvedValue(null); await a.state.saveLyrics()
    expect(listRecovery(storage)[0].context.markerPreview.startMs).toBe(1200)
    a.state.updateRecoveryContext({ markerPreview: null })
    expect(listRecovery(storage)).toHaveLength(0)
    a.scope.stop()
  })
  it('reports storage failure and preserves corrupted drafts', () => {
    const storage = memoryStorage(); const a = editor(storage)
    storage.setItem = () => { throw new Error('quota exceeded') }
    a.state.updatePlainLyrics('safe in editor')
    expect(a.state.flushRecovery()).toBe(false)
    expect(a.state.recoveryStatus.value).toContain('quota exceeded')
    a.scope.stop()
    const corrupted = memoryStorage()
    const key = RECOVERY_PREFIX + recoveryTarget({ title: 'Song', artist_name: 'Singer', file_path: '/music/1.mp3' }, null, 1)
    corrupted.setItem(key, '{broken')
    const b = editor(corrupted)
    expect(b.state.flushRecovery()).toBe(false)
    expect(corrupted.getItem(key)).toBe('{broken')
    b.scope.stop()
  })
  it('does not resurrect explicitly abandoned work during disposal', () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updatePlainLyrics('abandoned')
    a.state.discardRecovery(true); a.scope.stop()
    expect(listRecovery(storage)).toHaveLength(0)
  })
  it('serializes pending typing for export and commits it on Save', async () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updateSyncedLines(lines)
    a.state.updatePendingSentence({ lineIndex: 0, originalText: 'first word', text: 'edited sentence' })
    expect(a.state.serializedLyricsfile.value).toContain('edited sentence')
    invoke.mockResolvedValue(null)
    await a.state.saveLyrics()
    expect(a.state.syncedLines.value[0]).toMatchObject({ text: 'edited sentence', words: [] })
    expect(listRecovery(storage)).toHaveLength(0)
    a.scope.stop()
  })
  it('retains sentence typing begun while Save is in flight', async () => {
    const storage = memoryStorage(); const a = editor(storage)
    a.state.updateSyncedLines(lines)
    let complete
    invoke.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const saving = a.state.saveLyrics()
    a.state.updatePendingSentence({ lineIndex: 0, originalText: 'first word', text: 'later typing' })
    complete(null); await saving
    expect(listRecovery(storage)[0].document.synced[0].text).toBe('later typing')
    a.scope.stop()
  })
  it('namespaces standalone lyrics by server and guards library ID reuse', () => {
    expect(recoveryTarget(null, { id: 2 }, null, 'server-a')).not.toBe(recoveryTarget(null, { id: 2 }, null, 'server-b'))
    expect(recoveryTarget({ file_path: '/old.mp3' }, null, 1)).not.toBe(recoveryTarget({ file_path: '/new.mp3' }, null, 1))
  })


})
