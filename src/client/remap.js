/**
 * Rename changes the Host's content-derived ids: a group rename also changes
 * every list / bookmark id below it, and a list rename changes its bookmarks.
 * The Host returns the old→new pairs; these helpers carry the reader's local
 * selection, expansion, and manual order across that id churn.
 */

function pairMap(pairs) {
  const map = new Map()
  if (!Array.isArray(pairs)) return map
  for (const pair of pairs) {
    if (
      pair !== null &&
      typeof pair === 'object' &&
      typeof pair.from === 'string' &&
      typeof pair.to === 'string'
    ) {
      map.set(pair.from, pair.to)
    }
  }
  return map
}

/** Build the three lookup maps carried by the Host's `renamed` payload. */
function renameMaps(renamed) {
  const groups = new Map()
  const lists = pairMap(renamed?.lists)
  const bookmarks = pairMap(renamed?.bookmarks)

  if (
    renamed?.kind === 'group' &&
    typeof renamed.oldGroupId === 'string' &&
    typeof renamed.groupId === 'string'
  ) {
    groups.set(renamed.oldGroupId, renamed.groupId)
  }
  if (
    renamed?.kind === 'list' &&
    typeof renamed.oldListId === 'string' &&
    typeof renamed.listId === 'string'
  ) {
    lists.set(renamed.oldListId, renamed.listId)
  }

  return { groups, lists, bookmarks }
}

function remapId(id, map) {
  if (id === null || id === undefined) return id
  return map.get(id) ?? id
}

function remapIds(ids, map) {
  return ids.map((id) => map.get(id) ?? id)
}

/** Rewrites the saved drag order so a rename does not discard it. */
function remapOrderForRename(order, renamed) {
  const maps = renameMaps(renamed)

  const groups = remapIds(order.groups, maps.groups)

  const lists = {}
  for (const [groupId, ids] of Object.entries(order.lists)) {
    const nextGroup = remapId(groupId, maps.groups)
    lists[nextGroup] = remapIds(ids, maps.lists)
  }

  const bookmarks = {}
  for (const [listId, ids] of Object.entries(order.bookmarks)) {
    const nextList = remapId(listId, maps.lists)
    bookmarks[nextList] = remapIds(ids, maps.bookmarks)
  }

  return { groups, lists, bookmarks }
}

/** Moves the expanded/collapsed flags to the renamed list ids. */
function remapExpandedForRename(expanded, renamed) {
  const maps = renameMaps(renamed)
  const next = {}
  for (const [listId, open] of Object.entries(expanded)) {
    next[remapId(listId, maps.lists)] = open
  }
  return next
}

/** Keeps a selection across a rename instead of silently losing it. */
function remapSelectedForRename(selected, renamed) {
  const maps = renameMaps(renamed)
  const next = new Set()
  for (const id of selected) next.add(remapId(id, maps.bookmarks))
  return next
}

module.exports = {
  renameMaps,
  remapId,
  remapOrderForRename,
  remapExpandedForRename,
  remapSelectedForRename,
}
