/**
 * Archive (资料库) — host half.
 *
 * The panel itself is the Client module. The Host owns the two things a page
 * cannot do safely on its own:
 *
 * - it reads the bookmark export bundled in `data/bookmarks.json` and serves a
 *   normalized collection, so the page never has to understand the exporter's
 *   format and a re-export only replaces one file;
 * - it opens a bookmark in the system browser. A `target="_blank"` anchor
 *   inside the Web GUI would open another frame of the GUI, not the user's
 *   browser, so a click goes through `POST /dsh-archive/open`.
 *
 * Both routes are same-origin only. The open route accepts nothing but an
 * absolute http(s) URL and launches a fixed argv (no shell), so the page can
 * not use it to start arbitrary commands.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const BOOKMARKS_PATH = '/dsh-archive/bookmarks'
const OPEN_PATH = '/dsh-archive/open'
const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(PLUGIN_DIR, 'data', 'bookmarks.json')
const MAX_DATA_BYTES = 8 * 1024 * 1024
const MAX_BODY_BYTES = 8 * 1024
const FALLBACK_GROUP_NAME = '未命名分组'

/** Rejects a body with an unexpected content type before it is parsed. */
class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

function sendJson(response, status, payload) {
  if (response.headersSent || response.writableEnded) return
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  response.end(body)
}

/** A named route is reachable from any page that can reach the loopback origin. */
function isSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

function readBody(request) {
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

/** Returns the absolute http(s) form of a value, or null for anything else. */
function httpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * The exporter prefixes imported folders with "Import - ". It is noise in the
 * group list, so the display name drops that prefix and keeps the rest verbatim.
 */
function displayGroupName(name, index) {
  const raw = typeof name === 'string' ? name.trim() : ''
  const cleaned = raw.replace(/^import\s*[-–—:]\s*/i, '').trim()
  return cleaned || raw || `${FALLBACK_GROUP_NAME} ${index + 1}`
}

function displayTitle(card, url) {
  const title = typeof card.title === 'string' ? card.title.trim() : ''
  const custom = typeof card.customTitle === 'string' ? card.customTitle.trim() : ''
  if (custom) return custom
  if (title) return title
  return url
}

/**
 * Shapes the exporter's tree into the one structure the page renders:
 * group -> list -> card, with stable ids, http(s)-only links, and no empty
 * leaves. The exporter's extra fields are dropped rather than forwarded, so a
 * future export format can not leak arbitrary keys into the DOM.
 */
function normalizeCollection(parsed) {
  const rawGroups = Array.isArray(parsed?.groups) ? parsed.groups : []
  const groups = []

  for (let groupIndex = 0; groupIndex < rawGroups.length; groupIndex += 1) {
    const rawGroup = rawGroups[groupIndex]
    if (rawGroup === null || typeof rawGroup !== 'object') continue
    const rawLists = Array.isArray(rawGroup.lists) ? rawGroup.lists : []
    const lists = []

    for (let listIndex = 0; listIndex < rawLists.length; listIndex += 1) {
      const rawList = rawLists[listIndex]
      if (rawList === null || typeof rawList !== 'object') continue
      const rawCards = Array.isArray(rawList.cards) ? rawList.cards : []
      const cards = []

      for (const rawCard of rawCards) {
        if (rawCard === null || typeof rawCard !== 'object') continue
        const url = httpUrl(rawCard.url)
        if (url === null) continue
        const icon = httpUrl(rawCard.favIconUrl)
        cards.push({
          id: `c${groupIndex}-${listIndex}-${cards.length}`,
          title: displayTitle(rawCard, url),
          url,
          icon,
        })
      }

      if (cards.length === 0) continue
      const title =
        typeof rawList.title === 'string' && rawList.title.trim()
          ? rawList.title.trim()
          : `列表 ${listIndex + 1}`
      lists.push({
        id: `g${groupIndex}-l${listIndex}`,
        title,
        count: cards.length,
        cards,
      })
    }

    const name = displayGroupName(rawGroup.name, groupIndex)
    if (lists.length === 0) continue
    groups.push({
      id: `g${groupIndex}`,
      name,
      count: lists.reduce((total, list) => total + list.count, 0),
      lists,
    })
  }

  return {
    title: '资料库',
    source: path.basename(DATA_FILE),
    stats: {
      groups: groups.length,
      lists: groups.reduce((total, group) => total + group.lists.length, 0),
      bookmarks: groups.reduce((total, group) => total + group.count, 0),
    },
    groups,
  }
}

async function loadCollection() {
  const text = await readFile(DATA_FILE, 'utf8')
  if (Buffer.byteLength(text) > MAX_DATA_BYTES) {
    throw new HttpError(500, 'bookmark-file-too-large')
  }
  let parsed
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new HttpError(500, 'bookmark-file-invalid-json')
  }
  const collection = normalizeCollection(parsed)
  if (collection.groups.length === 0) throw new HttpError(500, 'bookmark-file-empty')
  return collection
}

/**
 * The fixed argv that hands one URL to the desktop's default browser. Windows
 * needs an explicit empty window title, otherwise `start` reads the URL as one.
 */
function openerCommand(url) {
  if (process.platform === 'darwin') return { command: '/usr/bin/open', args: [url] }
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/c', 'start', '', url] }
  }
  return { command: 'xdg-open', args: [url] }
}

/** Resolves once the opener has actually started, so a failure is reportable. */
function launchExternal(url) {
  const { command, args } = openerCommand(url)
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(command, args, { detached: true, stdio: 'ignore' })
    } catch (error) {
      reject(error)
      return
    }
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function handleBookmarks(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method-not-allowed' })
    return
  }
  try {
    sendJson(response, 200, await loadCollection())
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.code })
      return
    }
    console.error('[archive] could not read the bookmark file:', error)
    sendJson(response, 500, { error: 'bookmark-file-unreadable' })
  }
}

async function handleOpen(request, response) {
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

  const target = httpUrl(payload?.url)
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

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: BOOKMARKS_PATH,
        handler: handleBookmarks,
      }),
    'archive: bookmark collection route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: OPEN_PATH,
        handler: handleOpen,
      }),
    'archive: external open route',
  )
}
