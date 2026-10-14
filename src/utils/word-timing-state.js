export const wordTimingStateKey = (lineIndex, wordIndex) => `${lineIndex}:${wordIndex}`

export const wordTimingFingerprint = (lineIndex, words, wordIndex) =>
  JSON.stringify([
    lineIndex,
    wordIndex,
    words[wordIndex]?.text,
    words[wordIndex]?.start_ms,
    words[wordIndex]?.end_ms,
  ])

export const countUnconfirmedWordAdjustments = (lines, adjustments, confirmations) => {
  const validEntries = entries =>
    Array.isArray(entries)
      ? entries.filter(
          entry =>
            Array.isArray(entry) &&
            typeof entry[0] === 'string' &&
            typeof entry[1] === 'string'
        )
      : []
  const confirmed = new Map(validEntries(confirmations))
  let count = 0

  for (const [key, savedFingerprint] of validEntries(adjustments)) {
    const [lineIndex, wordIndex] = key.split(':').map(Number)
    const line = lines[lineIndex]
    const words = line?.words
    if (!Number.isInteger(lineIndex) || !Number.isInteger(wordIndex) || !Array.isArray(words))
      continue

    const fingerprint = wordTimingFingerprint(lineIndex, words, wordIndex)
    if (fingerprint === savedFingerprint && confirmed.get(key) !== fingerprint) count++
  }

  return count
}
