/** The only scheme family the library accepts for a bookmark or its icon. */
export function toHttpUrl(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (raw === '') return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}
