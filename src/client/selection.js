/**
 * Pure selection helpers. The panel owns the React state; these functions only
 * turn the id set into ordered entries and counts, so the same ordering can
 * drive the bar, the selection summary, and a batch move request.
 */
const { applyOrder, matchesQuery } = require('./order.js')

/** Returns a new Set with `id` toggled. */
function toggleId(selected, id) {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Every selected bookmark in display order: group order, then list order, then
 * card order. Uses the whole library (not the search filter), so a hidden
 * selection keeps its position when it is moved.
 */
function selectedEntries(groups, order, selected) {
  if (selected.size === 0) return []
  const entries = []
  for (const group of applyOrder(groups, order.groups)) {
    for (const list of applyOrder(group.lists, order.lists[group.id] ?? [])) {
      for (const bookmark of applyOrder(list.bookmarks, order.bookmarks[list.id] ?? [])) {
        if (selected.has(bookmark.id)) entries.push({ group, list, bookmark })
      }
    }
  }
  return entries
}

/** Selected count per group id, for the left rail badges. */
function countsByGroup(entries) {
  const counts = new Map()
  for (const entry of entries) {
    counts.set(entry.group.id, (counts.get(entry.group.id) ?? 0) + 1)
  }
  return counts
}

/** How many distinct groups the selection touches. */
function groupCount(entries) {
  return new Set(entries.map((entry) => entry.group.id)).size
}

/** Selected bookmarks the current search hides. */
function hiddenByQuery(entries, query) {
  if (query === '') return 0
  return entries.reduce(
    (total, entry) => total + (matchesQuery(entry.bookmark, query) ? 0 : 1),
    0,
  )
}

/** Split a move into "already there" and "actually moving". */
function targetStats(entries, listId) {
  let inTarget = 0
  for (const entry of entries) {
    if (entry.list.id === listId) inTarget += 1
  }
  return { total: entries.length, inTarget, moving: entries.length - inTarget }
}

/** Fast lookup for the dialog snapshots. */
function entryMap(entries) {
  const map = new Map()
  for (const entry of entries) map.set(entry.bookmark.id, entry)
  return map
}

/** Drops selected ids whose list / group a structural delete removed. */
function pruneSelected(selected, collection) {
  if (selected.size === 0) return selected
  const valid = new Set()
  for (const group of collection?.groups ?? []) {
    for (const list of group.lists ?? []) {
      for (const bookmark of list.bookmarks ?? []) valid.add(bookmark.id)
    }
  }

  const next = new Set()
  for (const id of selected) {
    if (valid.has(id)) next.add(id)
  }
  return next.size === selected.size ? selected : next
}

module.exports = {
  toggleId,
  selectedEntries,
  countsByGroup,
  groupCount,
  hiddenByQuery,
  targetStats,
  entryMap,
  pruneSelected,
}
