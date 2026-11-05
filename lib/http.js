/**
 * Small HTTP helpers shared by the routes. They deliberately contain no plugin
 * knowledge: a route either writes a JSON response or throws `HttpError`.
 */
import { MAX_BODY_BYTES } from './config.js'

/** An expected request failure with a status code and a stable error code. */
export class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/** Writes one JSON response, tolerating a client that already disconnected. */
export function sendJson(response, status, payload) {
  if (response.headersSent || response.writableEnded) return
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  response.end(body)
}

/**
 * A named route is reachable from any page that can reach the loopback origin,
 * so a state-changing request must come from the page that serves it.
 */
export function isSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

/** Reads a bounded UTF-8 request body, rejecting before buffering too much. */
export function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false

    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    request.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        fail(new HttpError(413, 'request-too-large'))
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    request.on('error', fail)
  })
}
