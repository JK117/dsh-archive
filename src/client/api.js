/** The three Host calls the panel makes. All fail by throwing. */
const { LIBRARY_URL, MUTATE_URL, OPEN_URL } = require('./constants.js')

function asLibrary(payload) {
  if (!Array.isArray(payload?.groups)) throw new Error('invalid-library')
  return payload
}

async function fetchLibrary(signal) {
  const response = await fetch(LIBRARY_URL, {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return asLibrary(await response.json())
}

async function openBookmark(url) {
  const response = await fetch(OPEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
}

/**
 * One delete / move operation. On a 409 stale conflict the Host returns the
 * latest library alongside the error, so the caller can refresh in place.
 */
async function mutateLibrary(op, revision) {
  const response = await fetch(MUTATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ revision, op }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const code = typeof payload?.error === 'string' ? payload.error : 'mutation-failed'
    const error = new Error(code)
    error.code = code
    if (code === 'stale-library' && Array.isArray(payload?.groups)) {
      error.library = payload
    }
    throw error
  }

  return asLibrary(payload)
}

module.exports = { fetchLibrary, openBookmark, mutateLibrary }
