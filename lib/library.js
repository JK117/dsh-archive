/**
 * The persisted library model, its reader, and its one writer.
 *
 * The file is the plugin's own data, not a browser-export format:
 *
 *   {
 *     "groups": [
 *       { "name": "CSS", "lists": [
 *         { "title": "Positioning", "bookmarks": [
 *           { "title": "...", "url": "https://...", "icon": "https://..." }
 *         ] }
 *       ] }
 *     ]
 *   }
 *
 * Empty groups and empty lists are valid and are preserved: deleting the last
 * bookmark of a list only makes its `bookmarks` array empty. A file with
 * `"groups": []` is a valid empty library.
 *
 * Read ids are content-derived (`g_hash`, `l_hash`, `b_hash`) instead of
 * positional, so deleting or moving one entry never renumbers the others.
 * `icon` is optional. Reading is intentionally tolerant: malformed entries are
 * dropped, but a kept list/group can be empty.
 *
 * Writes are serialized, revision-checked, backed up as `bookmarks.json.bak`,
 * and atomically renamed over the original. Unknown fields on the raw objects
 * are preserved because mutation edits the parsed JSON in place.
 */
import { constants as fsConstants } from 'node:fs'
import { access, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { DATA_FILE, MAX_DATA_BYTES, MAX_MUTATE_IDS } from './config.js'
import { HttpError } from './http.js'
import { toHttpUrl } from './url.js'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function shortHash(value) {
  return createHash('sha1').update(value).digest('base64url').slice(0, 10)
}

function uniqueId(base, used) {
  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = base + '-' + suffix
    suffix += 1
  }
  used.add(id)
  return id
}

/**
 * Validates the persisted shape and builds both the render model and a map
 * from render id back to the raw JSON objects. The map is what lets a mutation
 * remove / append the original objects without rebuilding the file and losing
 * fields the panel does not render.
 *
 * @throws {HttpError} when the file is valid JSON but not a library.
 */
export function normalizeLibraryWithIndex(parsed) {
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.groups)) {
    throw new HttpError(500, 'bookmark-file-invalid-shape')
  }

  const used = new Set()
  const index = {
    groups: new Map(),
    lists: new Map(),
    bookmarks: new Map(),
  }
  const groups = []

  for (const rawGroup of parsed.groups) {
    if (rawGroup === null || typeof rawGroup !== 'object') continue
    const name = text(rawGroup.name)
    if (name === '') continue

    const groupId = uniqueId('g_' + shortHash(name), used)
    const lists = []
    const rawLists = Array.isArray(rawGroup.lists) ? rawGroup.lists : []

    for (const rawList of rawLists) {
      if (rawList === null || typeof rawList !== 'object') continue
      const title = text(rawList.title)
      if (title === '') continue

      const listId = uniqueId('l_' + shortHash(groupId + '\u0000' + title), used)
      const bookmarks = []
      const rawBookmarks = Array.isArray(rawList.bookmarks) ? rawList.bookmarks : []

      for (const rawBookmark of rawBookmarks) {
        if (rawBookmark === null || typeof rawBookmark !== 'object') continue
        const url = toHttpUrl(rawBookmark.url)
        if (url === null) continue

        const bookmarkTitle = text(rawBookmark.title) || url
        const bookmarkId = uniqueId(
          'b_' + shortHash(listId + '\u0000' + url + '\u0000' + bookmarkTitle),
          used,
        )
        const bookmark = {
          id: bookmarkId,
          title: bookmarkTitle,
          url,
        }
        const icon = toHttpUrl(rawBookmark.icon)
        if (icon !== null) bookmark.icon = icon

        bookmarks.push(bookmark)
        index.bookmarks.set(bookmarkId, {
          raw: rawBookmark,
          rawList,
          groupId,
          listId,
        })
      }

      lists.push({
        id: listId,
        title,
        count: bookmarks.length,
        bookmarks,
      })
      index.lists.set(listId, {
        raw: rawList,
        rawGroup,
        groupId,
      })
    }

    groups.push({
      id: groupId,
      name,
      count: lists.reduce((total, list) => total + list.count, 0),
      lists,
    })
    index.groups.set(groupId, { raw: rawGroup })
  }

  return {
    library: {
      stats: {
        groups: groups.length,
        lists: groups.reduce((total, group) => total + group.lists.length, 0),
        bookmarks: groups.reduce((total, group) => total + group.count, 0),
      },
      groups,
    },
    index,
  }
}

/** The render model only, for callers that do not need the raw index. */
export function normalizeLibrary(parsed) {
  return normalizeLibraryWithIndex(parsed).library
}

/** Stable fingerprint of the bytes the panel rendered. */
function revisionOf(source) {
  return createHash('sha256').update(source).digest('hex').slice(0, 16)
}

async function canMutate(filePath) {
  try {
    await access(filePath, fsConstants.W_OK)
    await access(path.dirname(filePath), fsConstants.W_OK)
    return true
  } catch {
    return false
  }
}

function validateOp(op) {
  if (op === null || typeof op !== 'object') throw new HttpError(400, 'invalid-op')
  if (op.type !== 'delete' && op.type !== 'move') throw new HttpError(400, 'invalid-op')

  const rawIds = Array.isArray(op.ids) ? op.ids : null
  if (rawIds === null) throw new HttpError(400, 'invalid-op')

  const ids = []
  const seen = new Set()
  for (const id of rawIds) {
    if (typeof id !== 'string' || id === '') throw new HttpError(400, 'invalid-op')
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  if (ids.length === 0 || ids.length > MAX_MUTATE_IDS) {
    throw new HttpError(400, 'invalid-op')
  }

  if (op.type === 'move') {
    const target = op.target
    if (target === null || typeof target !== 'object') throw new HttpError(400, 'invalid-op')
    if (typeof target.groupId !== 'string' || typeof target.listId !== 'string') {
      throw new HttpError(400, 'invalid-op')
    }
    return { type: 'move', ids, target: { groupId: target.groupId, listId: target.listId } }
  }

  return { type: 'delete', ids }
}

/**
 * A store bound to one data file. Exported so the smoke test can run real
 * read/write cycles against a temporary fixture instead of the shipped data.
 */
export function createLibraryStore(filePath) {
  let queue = Promise.resolve()

  async function snapshot() {
    let source
    try {
      source = await readFile(filePath, 'utf8')
    } catch (error) {
      throw new HttpError(500, 'bookmark-file-unreadable')
    }
    if (Buffer.byteLength(source) > MAX_DATA_BYTES) {
      throw new HttpError(500, 'bookmark-file-too-large')
    }

    let parsed
    try {
      parsed = JSON.parse(source.replace(/^\uFEFF/, ''))
    } catch {
      throw new HttpError(500, 'bookmark-file-invalid-json')
    }

    const model = normalizeLibraryWithIndex(parsed)
    const revision = revisionOf(source)
    const capabilities = { mutate: await canMutate(filePath) }

    return {
      source,
      parsed,
      index: model.index,
      revision,
      capabilities,
      library: {
        revision,
        capabilities,
        ...model.library,
      },
    }
  }

  async function load() {
    return (await snapshot()).library
  }

  async function writeAtomic(current) {
    const json = JSON.stringify(current.parsed, null, 2) + '\n'
    let mode = 0o600
    try {
      mode = (await stat(filePath)).mode & 0o777
    } catch {
      // Keep the safe default if the file vanished between read and write.
    }

    const temp = filePath + '.tmp-' + process.pid + '-' + Date.now()
    try {
      await writeFile(filePath + '.bak', current.source, { mode })
      await writeFile(temp, json, { mode })
      await rename(temp, filePath)
    } catch (error) {
      await unlink(temp).catch(() => {})
      if (error instanceof HttpError) throw error
      throw new HttpError(500, 'write-failed')
    }
  }

  async function runMutation(op, expectedRevision) {
    const current = await snapshot()

    if (
      typeof expectedRevision === 'string' &&
      expectedRevision !== '' &&
      expectedRevision !== current.revision
    ) {
      const error = new HttpError(409, 'stale-library')
      error.library = current.library
      throw error
    }

    const validated = validateOp(op)
    for (const id of validated.ids) {
      if (!current.index.bookmarks.has(id)) {
        throw new HttpError(404, 'unknown-bookmark')
      }
    }

    if (validated.type === 'delete') {
      for (const id of validated.ids) {
        const entry = current.index.bookmarks.get(id)
        const list = entry.rawList
        if (!Array.isArray(list.bookmarks)) continue
        const at = list.bookmarks.indexOf(entry.raw)
        if (at !== -1) list.bookmarks.splice(at, 1)
      }
    } else {
      const targetEntry = current.index.lists.get(validated.target.listId)
      if (targetEntry === undefined || targetEntry.groupId !== validated.target.groupId) {
        throw new HttpError(404, 'unknown-target')
      }

      const target = targetEntry.raw
      if (!Array.isArray(target.bookmarks)) target.bookmarks = []

      const moving = []
      for (const id of validated.ids) {
        const entry = current.index.bookmarks.get(id)
        if (entry.listId === validated.target.listId) continue
        const source = entry.rawList
        if (!Array.isArray(source.bookmarks)) continue
        const at = source.bookmarks.indexOf(entry.raw)
        if (at === -1) continue
        source.bookmarks.splice(at, 1)
        moving.push(entry.raw)
      }
      if (moving.length === 0) throw new HttpError(400, 'no-op')
      target.bookmarks.push(...moving)
    }

    await writeAtomic(current)
    return load()
  }

  function mutate(op, expectedRevision) {
    const run = () => runMutation(op, expectedRevision)
    const result = queue.then(run, run)
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return { load, mutate }
}

const defaultStore = createLibraryStore(DATA_FILE)

/** Reads the data file on every request so replacing it needs no restart. */
export function loadLibrary() {
  return defaultStore.load()
}

/** Applies one delete / move operation and returns the new library. */
export function mutateLibrary(op, expectedRevision) {
  return defaultStore.mutate(op, expectedRevision)
}
