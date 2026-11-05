/** The two Host calls the panel makes. Both fail by throwing. */
const { LIBRARY_URL, OPEN_URL } = require('./constants.js')

async function fetchLibrary(signal) {
  const response = await fetch(LIBRARY_URL, {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const payload = await response.json()
  if (!Array.isArray(payload?.groups) || payload.groups.length === 0) {
    throw new Error('empty-collection')
  }
  return payload
}

async function openBookmark(url) {
  const response = await fetch(OPEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
}

module.exports = { fetchLibrary, openBookmark }
