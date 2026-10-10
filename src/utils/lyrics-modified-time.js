export const lyricsModifiedTime = timestamp => {
  if (!timestamp) return null
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return null
  return {
    date: date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }),
    time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    description: `Lyrics last saved in LRCGET: ${date.toLocaleString()}`,
  }
}
