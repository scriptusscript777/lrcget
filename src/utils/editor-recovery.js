// Recovery is separate from SQLite saves and lyric exports. Each write replaces
// one complete record synchronously, before a close/crash can lose Vue state.
export const RECOVERY_PREFIX = 'lrcget.editor-recovery.v1:'
export const RECOVERY_EVENT = 'lrcget-editor-recovery'
export function recoveryStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
export function recoveryTarget(audio, lyricsfile, trackId, instance = '') {
  if (trackId != null)
    return JSON.stringify([
      'track',
      trackId,
      audio?.file_path ?? '',
      audio?.title ?? '',
      audio?.artist_name ?? '',
    ])
  if (lyricsfile?.id != null) return JSON.stringify(['lyricsfile', instance, lyricsfile.id])
  return null
}
const validTime = value => value == null || (Number.isFinite(value) && value >= 0)
export function validRecoveryDocument(doc) {
  return (
    !!doc &&
    typeof doc.plain === 'string' &&
    typeof doc.instrumental === 'boolean' &&
    Array.isArray(doc.synced) &&
    doc.synced.every(
      line =>
        line &&
        typeof line.text === 'string' &&
        validTime(line.start_ms) &&
        validTime(line.end_ms) &&
        (line.words == null ||
          (Array.isArray(line.words) &&
            line.words.every(
              word =>
                word &&
                typeof word.text === 'string' &&
                validTime(word.start_ms) &&
                validTime(word.end_ms)
            )))
    )
  )
}
export function readRecovery(storage, target) {
  if (!storage || !target) return null
  const raw = storage.getItem(RECOVERY_PREFIX + target)
  if (!raw) return null
  const record = JSON.parse(raw)
  if (
    record.schema !== 1 ||
    record.target !== target ||
    typeof record.baseline !== 'string' ||
    !validRecoveryDocument(record.document) ||
    !Number.isFinite(record.updatedAt)
  )
    throw new Error('Recovery draft is unreadable; it has been preserved.')
  return record
}
export function writeRecovery(storage, target, record) {
  if (!storage || !target) throw new Error('Recovery storage is unavailable.')
  storage.setItem(
    RECOVERY_PREFIX + target,
    JSON.stringify({ ...record, schema: 1, target, updatedAt: Date.now() })
  )
  notifyRecovery()
}
export function removeRecovery(storage, target) {
  if (!storage || !target) throw new Error('Recovery storage is unavailable.')
  storage.removeItem(RECOVERY_PREFIX + target)
  notifyRecovery()
}
export function listRecovery(storage = recoveryStorage()) {
  if (!storage) return []
  const records = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key?.startsWith(RECOVERY_PREFIX)) continue
      try {
        const record = readRecovery(storage, key.slice(RECOVERY_PREFIX.length))
        if (record) records.push(record)
      } catch {
        /* Preserve unreadable records. */
      }
    }
  } catch {
    return []
  }
  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}
function notifyRecovery() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RECOVERY_EVENT))
}
