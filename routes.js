/**
 * The routes the browser half calls.
 *
 * All handlers are same-origin only. `open` accepts nothing but an absolute
 * http(s) URL and calls a fixed platform opener; `mutate` only deletes, moves,
 * creates, or imports bookmarks inside the library, by id or by a validated
 * group/list target, and never accepts a path.
 */
import { MAX_MUTATE_BYTES } from './lib/config.js'
import { launchExternal } from './lib/external.js'
import { HttpError, isSameOrigin, readBody, sendJson } from './lib/http.js'
import { loadLibrary, mutateLibrary } from './lib/library.js'
import { toHttpUrl } from './lib/url.js'

/** `GET /dsh-archive/bookmarks`: the normalized library. */
export async function handleLibrary(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }

  try {
    sendJson(response, 200, await loadLibrary())
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.code })
      return
    }
    console.error('[archive] could not read the bookmark file:', error)
    sendJson(response, 500, { error: 'bookmark-file-unreadable' })
  }
}

/** `POST /dsh-archive/open`: `{ "url": "https://..." }` in the system browser. */
export async function handleOpen(request, response) {
  if (!isSameOrigin(request)) {
    sendJson(response, 403, { error: 'cross-origin-request' })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { error: 'unsupported-media-type' })
    return
  }

  let payload
  try {
    payload = JSON.parse(await readBody(request))
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.code })
      return
    }
    sendJson(response, 400, { error: 'invalid-json' })
    return
  }

  const target = toHttpUrl(payload?.url)
  if (target === null) {
    sendJson(response, 400, { error: 'invalid-url' })
    return
  }

  try {
    await launchExternal(target)
    sendJson(response, 200, { ok: true })
  } catch (error) {
    console.error('[archive] could not launch the default browser:', error)
    sendJson(response, 502, { error: 'open-failed' })
  }
}

/**
 * `POST /dsh-archive/mutate`: one delete, move, create, or import operation.
 *
 * Request: `{ "revision": "...", "op": { "type": "...", ... } }`.
 * Success returns the full new library (plus `created` / `imported` details
 * for the two write-forward operations), so the page never has to refetch.
 */
export async function handleMutate(request, response) {
  if (!isSameOrigin(request)) {
    sendJson(response, 403, { error: 'cross-origin-request' })
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { error: 'unsupported-media-type' })
    return
  }

  let payload
  try {
    payload = JSON.parse(await readBody(request, MAX_MUTATE_BYTES))
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.code })
      return
    }
    sendJson(response, 400, { error: 'invalid-json' })
    return
  }

  const revision = typeof payload?.revision === 'string' ? payload.revision : ''

  try {
    const library = await mutateLibrary(payload?.op, revision)
    sendJson(response, 200, library)
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.code === 'stale-library' && error.library !== undefined) {
        sendJson(response, 409, { error: error.code, ...error.library })
        return
      }
      sendJson(response, error.status, { error: error.code })
      return
    }
    console.error('[archive] could not write the bookmark file:', error)
    sendJson(response, 500, { error: 'write-failed' })
  }
}
