import { onScopeDispose } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// Backend-issued sessions and ordered revisions reject stale editor commands.
export function useNativePlaybackLoop() {
  let sessionPromise = null
  let revision = 0
  let disposed = false
  const setLoopRange = async (range, source) => {
    if (disposed && range) return false
    const request = ++revision
    const target = {
      trackId: source?.type === 'library' ? source.id : null,
      filePath: source?.file_path ?? null,
      start: range?.start ?? null,
      end: range?.end ?? null,
    }
    if (!sessionPromise) {
      if (!range) return true
      sessionPromise = invoke('begin_playback_loop_session').catch(error => {
        sessionPromise = null
        throw error
      })
    }
    const sessionId = await sessionPromise
    if (request !== revision) return false
    return invoke('set_playback_loop', {
      sessionId,
      revision: request,
      ...target,
    })
  }
  onScopeDispose(() => {
    disposed = true
    // Do not let an older editor's late cleanup cancel a newer backend session.
    setLoopRange(null, null).catch(error => console.error('Failed to clear editor loop', error))
  })
  return { setLoopRange }
}
