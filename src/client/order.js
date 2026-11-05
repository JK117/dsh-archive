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
  orderListBookmarks,
  filterListBookmarks,
}
