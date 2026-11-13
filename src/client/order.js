/**
 * Pure helpers for the reader's manual order and search. Keeping them free of
 * React makes the state transitions in `panel.js` short and testable.
 */

/** The shape persisted under `dsh-archive:order:v2`. */
function emptyOrder() {
  return { groups: [], lists: {}, bookmarks: {} }
}

function stringIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
}

/**
 * Applies a remembered id order to one level. Ids that disappeared are
 * ignored, and items that are new since the order was saved keep their data
 * position at the end.
 */
function applyOrder(items, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item !== undefined) {
      ordered.push(item)
      byId.delete(id)
    }
  }
  if (ordered.length === items.length) return ordered
  for (const item of items) {
    if (byId.has(item.id)) ordered.push(item)
  }
  return ordered
}

/**
 * Moves one id to an insertion slot in the full order. Slots are counted
 * before the drag, so the dragged item itself still occupies its old slot.
 */
function moveId(ids, from, to) {
  if (from < 0 || from >= ids.length || to < 0 || to > ids.length) return ids
  const destination = to > from ? to - 1 : to
  if (destination === from) return ids
  const next = ids.slice()
  const [id] = next.splice(from, 1)
  next.splice(destination, 0, id)
  return next
}

function matchesQuery(bookmark, query) {
  return (
    bookmark.title.toLowerCase().includes(query) ||
    bookmark.url.toLowerCase().includes(query)
  )
}

/**
 * Stable fingerprint of the loaded library. A saved order that belongs to a
 * different file must not scramble this one; any change to names, titles, or
 * URLs produces a new signature, while icon-only changes keep the order.
 */
function collectionSignature(collection) {
  const parts = []
  for (const group of collection?.groups ?? []) {
    parts.push(group.id, group.name)
    for (const list of group.lists ?? []) {
      parts.push(list.id, list.title)
      for (const bookmark of list.bookmarks ?? []) {
        parts.push(bookmark.id, bookmark.title, bookmark.url)
      }
    }
  }
  const text = parts.join('\u0001')
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36) + ':' + text.length.toString(36)
}

/** Hits per group while searching, or null when the query is empty. */
function countGroupMatches(groups, query) {
  if (query === '') return null
  const counts = new Map()
  for (const group of groups) {
    let total = 0
    for (const list of group.lists) {
      for (const bookmark of list.bookmarks) {
        if (matchesQuery(bookmark, query)) total += 1
      }
    }
    counts.set(group.id, total)
  }
  return counts
}

/**
 * Drops ids that no longer exist from the per-list order. A delete or move
 * changes the library; keeping the old ids would let a bookmark moved away and
 * later back "resurrect" its old slot, and would leave dead entries behind.
 */
function pruneOrder(order, collection) {
  const validGroups = new Set()
  const validLists = new Set()
  const validBookmarks = new Set()
  for (const group of collection.groups) {
    validGroups.add(group.id)
    for (const list of group.lists) {
      validLists.add(list.id)
      for (const bookmark of list.bookmarks) validBookmarks.add(bookmark.id)
    }
  }

  let changed = false
  const groups = order.groups.filter((id) => validGroups.has(id))
  if (groups.length !== order.groups.length) changed = true

  const lists = {}
  for (const [groupId, ids] of Object.entries(order.lists)) {
    if (!validGroups.has(groupId)) {
      changed = true
      continue
    }
    const kept = ids.filter((id) => validLists.has(id))
    lists[groupId] = kept
    if (kept.length !== ids.length) changed = true
  }

  const bookmarks = {}
  for (const [listId, ids] of Object.entries(order.bookmarks)) {
    if (!validLists.has(listId)) {
      changed = true
      continue
    }
    const kept = ids.filter((id) => validBookmarks.has(id))
    bookmarks[listId] = kept
    if (kept.length !== ids.length) changed = true
  }
  return changed ? { ...order, groups, lists, bookmarks } : order
}

/** Drops expanded/collapsed flags for lists a structural delete removed. */
function pruneExpanded(expanded, collection) {
  const valid = new Set()
  for (const group of collection.groups ?? []) {
    for (const list of group.lists ?? []) valid.add(list.id)
  }

  let changed = false
  const next = {}
  for (const [listId, open] of Object.entries(expanded)) {
    if (valid.has(listId)) next[listId] = open
    else changed = true
  }
  return changed ? next : expanded
}

/** Returns a copy of the list with its bookmarks in the reader's order. */
function orderListBookmarks(list, order) {
  return {
    ...list,
    bookmarks: applyOrder(list.bookmarks, order.bookmarks[list.id] ?? []),
  }
}

/** Returns the matching subset of a list, or null when nothing matches. */
function filterListBookmarks(list, order, query) {
  const bookmarks = applyOrder(list.bookmarks, order.bookmarks[list.id] ?? []).filter(
    (bookmark) => matchesQuery(bookmark, query),
  )
  if (bookmarks.length === 0) return null
  return { ...list, bookmarks, count: bookmarks.length }
}

module.exports = {
  emptyOrder,
  stringIds,
  applyOrder,
  moveId,
  matchesQuery,
  collectionSignature,
  countGroupMatches,
  pruneOrder,
  pruneExpanded,
  orderListBookmarks,
  filterListBookmarks,
}
