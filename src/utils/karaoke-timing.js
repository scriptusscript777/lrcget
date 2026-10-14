export const getCurrentWordIndex = (line, currentTimeMs) => {
  if (!Array.isArray(line?.words) || !Number.isFinite(currentTimeMs)) return -1

  for (let index = 0; index < line.words.length; index++) {
    const word = line.words[index]
    if (!Number.isFinite(word?.start_ms)) continue

    const nextStart = line.words[index + 1]?.start_ms
    const wordEnd = Number.isFinite(word.end_ms)
      ? word.end_ms
      : Number.isFinite(nextStart)
        ? nextStart
        : Infinity

    if (currentTimeMs >= word.start_ms && currentTimeMs < wordEnd) return index
  }

  return -1
}
