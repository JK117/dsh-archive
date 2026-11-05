/**
 * The two named routes the browser half calls.
 *
 * Both handlers are same-origin only. `open` accepts nothing but an absolute
 * http(s) URL and calls a fixed platform opener, so the page can not use it to
 * start arbitrary commands.
 */
import { launchExternal } from './lib/external.js'
import { HttpError, isSameOrigin, readBody, sendJson } from './lib/http.js'
import { loadLibrary } from './lib/library.js'
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
