/**
 * The persisted library model and its one reader.
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
 * `icon` is optional. The Host owns the display ids (`g0`, `g0-l0`,
 * `g0-l0-b0`) and derives every count, so the file never stores state that
 * can disagree with its contents. Reading is intentionally tolerant: an empty
 * group, an empty list, or a bookmark with a non-http(s) URL is dropped rather
 * than failing the whole page.
 */
import { readFile } from 'node:fs/promises'
import { DATA_FILE, MAX_DATA_BYTES } from './config.js'
import { HttpError } from './http.js'
import { toHttpUrl } from './url.js'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBookmarks(rawList, listId) {
  const rawBookmarks = Array.isArray(rawList.bookmarks) ? rawList.bookmarks : []
  const bookmarks = []

  for (const rawBookmark of rawBookmarks) {
    if (rawBookmark === null || typeof rawBookmark !== 'object') continue
    const url = toHttpUrl(rawBookmark.url)
    if (url === null) continue

    const bookmark = {
      id: `${listId}-b${bookmarks.length}`,
      title: text(rawBookmark.title) || url,
      url,
    }
    const icon = toHttpUrl(rawBookmark.icon)
    if (icon !== null) bookmark.icon = icon
    bookmarks.push(bookmark)
  }

  return bookmarks
}

function normalizeLists(rawGroup, groupId) {
  const rawLists = Array.isArray(rawGroup.lists) ? rawGroup.lists : []
  const lists = []

  for (const rawList of rawLists) {
    if (rawList === null || typeof rawList !== 'object') continue
    const title = text(rawList.title)
    if (title === '') continue

    const listId = `${groupId}-l${lists.length}`
    const bookmarks = normalizeBookmarks(rawList, listId)
    if (bookmarks.length === 0) continue

    lists.push({
      id: listId,
      title,
      count: bookmarks.length,
      bookmarks,
    })
  }

  return lists
}

/**
 * Validates the persisted shape and builds the render model. Exported so the
 * route and a maintenance script share exactly one definition of "valid".
 *
 * @throws {HttpError} when the file is valid JSON but not a library.
 */
export function normalizeLibrary(parsed) {
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.groups)) {
    throw new HttpError(500, 'bookmark-file-invalid-shape')
  }

  const groups = []
  for (const rawGroup of parsed.groups) {
    if (rawGroup === null || typeof rawGroup !== 'object') continue
    const name = text(rawGroup.name)
    if (name === '') continue

    const groupId = `g${groups.length}`
    const lists = normalizeLists(rawGroup, groupId)
    if (lists.length === 0) continue

    groups.push({
      id: groupId,
      name,
      count: lists.reduce((total, list) => total + list.count, 0),
      lists,
    })
  }

  if (groups.length === 0) throw new HttpError(500, 'bookmark-file-empty')

  return {
    stats: {
      groups: groups.length,
      lists: groups.reduce((total, group) => total + group.lists.length, 0),
      bookmarks: groups.reduce((total, group) => total + group.count, 0),
    },
    groups,
  }
}

/** Reads the data file on every request so replacing it needs no restart. */
export async function loadLibrary() {
  const source = await readFile(DATA_FILE, 'utf8')
  if (Buffer.byteLength(source) > MAX_DATA_BYTES) {
    throw new HttpError(500, 'bookmark-file-too-large')
  }

  let parsed
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, ''))
  } catch {
    throw new HttpError(500, 'bookmark-file-invalid-json')
  }

  return normalizeLibrary(parsed)
}
