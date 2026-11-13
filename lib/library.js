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
 * are preserved because mutation edits the parsed JSON in place. Imports pass
 * through `normalizeImport` first, so only `name` / `title` / `url` / `icon`
 * from the imported document can reach the file.
 */
import { constants as fsConstants } from 'node:fs'
import { access, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { DATA_FILE, MAX_DATA_BYTES, MAX_MUTATE_IDS, MAX_NAME_LENGTH } from './config.js'
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

/**
 * The older browser-extension exporter prefixed imported folders with
 * "Import - ". That prefix is exporter noise, not part of the group name.
 */
function cleanImportedGroupName(value) {
  const raw = text(value)
  if (raw === '') return ''
  const cleaned = raw.replace(/^import\s*[-–—:]\s*/i, '').trim()
  return cleaned === '' ? raw : cleaned
}

/**
 * One imported bookmark reduced to the three fields the panel renders.
 * `customTitle` is the exporter's user-assigned title, so it wins when
 * present; `favIconUrl` becomes `icon`. Everything else (`description`,
 * `customDescription`, ids, timestamps, …) is metadata and is dropped.
 */
function importedBookmark(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const url = toHttpUrl(raw.url)
  if (url === null) return null

  const bookmark = {
    title: text(raw.customTitle) || text(raw.title) || url,
    url,
  }
  const icon = toHttpUrl(raw.icon) ?? toHttpUrl(raw.favIconUrl)
  if (icon !== null) bookmark.icon = icon
  return bookmark
}

/**
 * Cleans an imported JSON document into the library's own two-level shape.
 *
 * The canonical shape is `groups[].lists[].bookmarks[]`; the legacy
 * browser-extension shape (`lists[].cards[]`) is accepted as well. Only
 * `name` / `title` / `url` / `icon` survive, so a future exporter cannot leak
 * arbitrary keys into the file or the DOM. Empty groups / lists are kept, but
 * structures without a name, title, or bookmark array are dropped and counted
 * in `skipped`.
 *
 * @throws {HttpError} when the document has no `groups` array at all.
 */
export function normalizeImport(parsed) {
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !Array.isArray(parsed.groups)
  ) {
    throw new HttpError(400, 'invalid-import')
  }

  const skipped = { groups: 0, lists: 0, bookmarks: 0 }
  const groups = []

  for (const rawGroup of parsed.groups) {
    if (
      rawGroup === null ||
      typeof rawGroup !== 'object' ||
      Array.isArray(rawGroup) ||
      !Array.isArray(rawGroup.lists)
    ) {
      skipped.groups += 1
      continue
    }

    const name = cleanImportedGroupName(rawGroup.name)
    if (name === '') {
      skipped.groups += 1
      continue
    }

    const lists = []
    for (const rawList of rawGroup.lists) {
      if (rawList === null || typeof rawList !== 'object' || Array.isArray(rawList)) {
        skipped.lists += 1
        continue
      }

      let rawBookmarks = null
      if (Array.isArray(rawList.bookmarks)) rawBookmarks = rawList.bookmarks
      else if (Array.isArray(rawList.cards)) rawBookmarks = rawList.cards
      if (rawBookmarks === null) {
        skipped.lists += 1
        continue
      }

      const title = text(rawList.title)
      if (title === '') {
        skipped.lists += 1
        continue
      }

      const bookmarks = []
      for (const rawBookmark of rawBookmarks) {
        const bookmark = importedBookmark(rawBookmark)
        if (bookmark === null) {
          skipped.bookmarks += 1
          continue
        }
        bookmarks.push(bookmark)
      }

      lists.push({ title, bookmarks })
    }

    groups.push({ name, lists })
  }

  return { groups, skipped }
}

function findRawGroupByName(rawGroups, name) {
  for (const candidate of rawGroups) {
    if (candidate !== null && typeof candidate === 'object' && text(candidate.name) === name) {
      return candidate
    }
  }
  return null
}

function findRawListByTitle(rawLists, title) {
  for (const candidate of rawLists) {
    if (candidate !== null && typeof candidate === 'object' && text(candidate.title) === title) {
      return candidate
    }
  }
  return null
}

/** Renaming never merges, so a name another sibling already uses is a conflict. */
function hasOtherGroupNamed(rawGroups, name, self) {
  for (const candidate of rawGroups) {
    if (candidate === self || candidate === null || typeof candidate !== 'object') continue
    if (text(candidate.name) === name) return true
  }
  return false
}

function hasOtherListTitled(rawLists, title, self) {
  if (!Array.isArray(rawLists)) return false
  for (const candidate of rawLists) {
    if (candidate === self || candidate === null || typeof candidate !== 'object') continue
    if (text(candidate.title) === title) return true
  }
  return false
}

/** Locates the raw object behind a content-derived render id. */
function idOfRaw(index, raw) {
  for (const [id, entry] of index) {
    if (entry.raw === raw) return id
  }
  return null
}

/**
 * Merges one cleaned import into the raw library. Groups with the same name and
 * lists with the same title are reused instead of duplicated, and a bookmark
 * whose normalized URL already exists in the target list is skipped, so
 * importing the same file twice is harmless. Unknown fields on existing raw
 * objects stay untouched.
 */
function mergeImported(current, imported) {
  const result = { groups: 0, lists: 0, bookmarks: 0, duplicates: 0 }
  const rawGroups = current.parsed.groups

  for (const importedGroup of imported.groups) {
    let rawGroup = findRawGroupByName(rawGroups, importedGroup.name)
    if (rawGroup === null) {
      rawGroup = { name: importedGroup.name, lists: [] }
      rawGroups.push(rawGroup)
      result.groups += 1
    }
    if (!Array.isArray(rawGroup.lists)) rawGroup.lists = []

    for (const importedList of importedGroup.lists) {
      let rawList = findRawListByTitle(rawGroup.lists, importedList.title)
      if (rawList === null) {
        rawList = { title: importedList.title, bookmarks: [] }
        rawGroup.lists.push(rawList)
        result.lists += 1
      }
      if (!Array.isArray(rawList.bookmarks)) rawList.bookmarks = []

      const urls = new Set()
      for (const candidate of rawList.bookmarks) {
        const url = toHttpUrl(candidate?.url)
        if (url !== null) urls.add(url)
      }

      for (const bookmark of importedList.bookmarks) {
        if (urls.has(bookmark.url)) {
          result.duplicates += 1
          continue
        }
        urls.add(bookmark.url)
        rawList.bookmarks.push(bookmark)
        result.bookmarks += 1
      }
    }
  }

  return result
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

function requiredId(value) {
  if (typeof value !== 'string' || value === '') throw new HttpError(400, 'invalid-op')
  return value
}

/** A group name / list title must survive trimming and stay within the limit. */
function requiredLabel(value) {
  const label = text(value)
  if (label === '' || label.length > MAX_NAME_LENGTH) {
    throw new HttpError(400, 'invalid-name')
  }
  return label
}

function validateOp(op) {
  if (op === null || typeof op !== 'object') throw new HttpError(400, 'invalid-op')

  if (op.type === 'create') {
    const bookmark = op.bookmark
    if (bookmark === null || typeof bookmark !== 'object' || Array.isArray(bookmark)) {
      throw new HttpError(400, 'invalid-op')
    }
    const url = toHttpUrl(bookmark.url)
    if (url === null) throw new HttpError(400, 'invalid-url')

    const target = op.target
    if (target === null || typeof target !== 'object' || Array.isArray(target)) {
      throw new HttpError(400, 'invalid-op')
    }
    const groupId = typeof target.groupId === 'string' ? target.groupId : ''
    const listId = typeof target.listId === 'string' ? target.listId : ''
    const groupName = text(target.groupName)
    const listTitle = text(target.listTitle)

    if (groupId === '' && listId === '' && groupName === '') {
      throw new HttpError(400, 'invalid-op')
    }
    if (listId === '' && listTitle === '') {
      throw new HttpError(400, 'invalid-op')
    }

    return {
      type: 'create',
      bookmark: {
        title: text(bookmark.title),
        url,
        icon: toHttpUrl(bookmark.icon),
      },
      target: { groupId, listId, groupName, listTitle },
    }
  }

  if (op.type === 'import') {
    if (op.data === null || typeof op.data !== 'object' || Array.isArray(op.data)) {
      throw new HttpError(400, 'invalid-import')
    }
    return { type: 'import', data: op.data }
  }

  if (op.type === 'rename-group') {
    return { type: 'rename-group', groupId: requiredId(op.groupId), name: requiredLabel(op.name) }
  }

  if (op.type === 'rename-list') {
    return {
      type: 'rename-list',
      groupId: requiredId(op.groupId),
      listId: requiredId(op.listId),
      title: requiredLabel(op.title),
    }
  }

  if (op.type === 'delete-group') {
    return { type: 'delete-group', groupId: requiredId(op.groupId) }
  }

  if (op.type === 'delete-list') {
    return {
      type: 'delete-list',
      groupId: requiredId(op.groupId),
      listId: requiredId(op.listId),
    }
  }

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
    if (validated.type === 'delete' || validated.type === 'move') {
      for (const id of validated.ids) {
        if (!current.index.bookmarks.has(id)) {
          throw new HttpError(404, 'unknown-bookmark')
        }
      }
    }

    if (validated.type === 'rename-group' || validated.type === 'delete-group') {
      if (!current.index.groups.has(validated.groupId)) {
        throw new HttpError(404, 'unknown-group')
      }
    }

    if (validated.type === 'rename-list' || validated.type === 'delete-list') {
      const entry = current.index.lists.get(validated.listId)
      if (entry === undefined || entry.groupId !== validated.groupId) {
        throw new HttpError(404, 'unknown-list')
      }
    }

    let wrote = false
    let created = null
    let importedSummary = null
    let renamed = null

    if (validated.type === 'delete') {
      for (const id of validated.ids) {
        const entry = current.index.bookmarks.get(id)
        const list = entry.rawList
        if (!Array.isArray(list.bookmarks)) continue
        const at = list.bookmarks.indexOf(entry.raw)
        if (at !== -1) list.bookmarks.splice(at, 1)
      }
      wrote = true
    } else if (validated.type === 'move') {
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
      wrote = true
    } else if (validated.type === 'create') {
      const target = validated.target
      let rawGroup = null

      if (target.listId !== '') {
        const entry = current.index.lists.get(target.listId)
        if (entry === undefined) throw new HttpError(404, 'unknown-target')
        if (target.groupId !== '' && entry.groupId !== target.groupId) {
          throw new HttpError(400, 'invalid-target')
        }
        rawGroup = entry.rawGroup
      }

      if (rawGroup === null) {
        if (target.groupId !== '') {
          const entry = current.index.groups.get(target.groupId)
          if (entry === undefined) throw new HttpError(404, 'unknown-target')
          rawGroup = entry.raw
        } else if (target.groupName !== '') {
          rawGroup = findRawGroupByName(current.parsed.groups, target.groupName)
          if (rawGroup === null) {
            rawGroup = { name: target.groupName, lists: [] }
            current.parsed.groups.push(rawGroup)
          }
        } else {
          throw new HttpError(400, 'invalid-target')
        }
      }

      if (!Array.isArray(rawGroup.lists)) rawGroup.lists = []

      let rawList = null
      if (target.listId !== '') {
        rawList = current.index.lists.get(target.listId).raw
      } else {
        rawList = findRawListByTitle(rawGroup.lists, target.listTitle)
        if (rawList === null) {
          rawList = { title: target.listTitle, bookmarks: [] }
          rawGroup.lists.push(rawList)
        }
      }

      const bookmarks = Array.isArray(rawList.bookmarks) ? rawList.bookmarks : []
      if (!Array.isArray(rawList.bookmarks)) rawList.bookmarks = bookmarks

      for (const candidate of bookmarks) {
        if (toHttpUrl(candidate?.url) === validated.bookmark.url) {
          throw new HttpError(409, 'duplicate-bookmark')
        }
      }

      const rawBookmark = {
        title: validated.bookmark.title || validated.bookmark.url,
        url: validated.bookmark.url,
      }
      if (validated.bookmark.icon !== null) rawBookmark.icon = validated.bookmark.icon
      bookmarks.push(rawBookmark)

      const model = normalizeLibraryWithIndex(current.parsed)
      created = {
        groupId: idOfRaw(model.index.groups, rawGroup),
        listId: idOfRaw(model.index.lists, rawList),
        bookmarkId: idOfRaw(model.index.bookmarks, rawBookmark),
      }
      wrote = true
    } else if (validated.type === 'rename-group') {
      const entry = current.index.groups.get(validated.groupId)
      if (hasOtherGroupNamed(current.parsed.groups, validated.name, entry.raw)) {
        throw new HttpError(409, 'duplicate-group')
      }
      entry.raw.name = validated.name

      const model = normalizeLibraryWithIndex(current.parsed)
      const newGroupId = idOfRaw(model.index.groups, entry.raw)
      const lists = []
      const bookmarks = []
      for (const [oldId, candidate] of current.index.lists) {
        if (candidate.groupId !== validated.groupId) continue
        lists.push({ from: oldId, to: idOfRaw(model.index.lists, candidate.raw) })
      }
      for (const [oldId, candidate] of current.index.bookmarks) {
        if (candidate.groupId !== validated.groupId) continue
        bookmarks.push({ from: oldId, to: idOfRaw(model.index.bookmarks, candidate.raw) })
      }
      renamed = {
        kind: 'group',
        oldGroupId: validated.groupId,
        groupId: newGroupId,
        lists,
        bookmarks,
      }
      wrote = true
    } else if (validated.type === 'rename-list') {
      const entry = current.index.lists.get(validated.listId)
      if (hasOtherListTitled(entry.rawGroup.lists, validated.title, entry.raw)) {
        throw new HttpError(409, 'duplicate-list')
      }
      entry.raw.title = validated.title

      const model = normalizeLibraryWithIndex(current.parsed)
      const newListId = idOfRaw(model.index.lists, entry.raw)
      const bookmarks = []
      for (const [oldId, candidate] of current.index.bookmarks) {
        if (candidate.listId !== validated.listId) continue
        bookmarks.push({ from: oldId, to: idOfRaw(model.index.bookmarks, candidate.raw) })
      }
      renamed = {
        kind: 'list',
        groupId: validated.groupId,
        oldListId: validated.listId,
        listId: newListId,
        lists: [{ from: validated.listId, to: newListId }],
        bookmarks,
      }
      wrote = true
    } else if (validated.type === 'delete-group') {
      const raw = current.index.groups.get(validated.groupId).raw
      const at = current.parsed.groups.indexOf(raw)
      if (at !== -1) current.parsed.groups.splice(at, 1)
      wrote = true
    } else if (validated.type === 'delete-list') {
      const entry = current.index.lists.get(validated.listId)
      if (Array.isArray(entry.rawGroup.lists)) {
        const at = entry.rawGroup.lists.indexOf(entry.raw)
        if (at !== -1) entry.rawGroup.lists.splice(at, 1)
      }
      wrote = true
    } else {
      const imported = normalizeImport(validated.data)
      const result = mergeImported(current, imported)
      importedSummary = {
        ...result,
        skipped:
          result.duplicates +
          imported.skipped.groups +
          imported.skipped.lists +
          imported.skipped.bookmarks,
      }
      wrote = result.groups + result.lists + result.bookmarks > 0
    }

    if (wrote) await writeAtomic(current)
    const library = wrote ? await load() : { ...current.library }
    if (created !== null) library.created = created
    if (importedSummary !== null) library.imported = importedSummary
    if (renamed !== null) library.renamed = renamed
    return library
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

/** Applies one create / import / rename / delete / move operation and returns the new library. */
export function mutateLibrary(op, expectedRevision) {
  return defaultStore.mutate(op, expectedRevision)
}
