/**
 * The reader's local state: which group is selected, which lists are folded,
 * and the manual sort order. Both records are best-effort: storage may be
 * unavailable (private mode, full quota), which only costs that memory.
 */
const { ORDER_KEY, STATE_KEY } = require('./constants.js')
const { stringIds } = require('./order.js')

function readSavedState() {
  try {
    const raw = window.localStorage.getItem(STATE_KEY)
    if (raw === null) return { groupId: null, expanded: {} }
    const parsed = JSON.parse(raw)
    const expanded =
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof parsed.expanded === 'object' &&
      parsed.expanded !== null
        ? parsed.expanded
        : {}
    return {
      groupId: typeof parsed?.groupId === 'string' ? parsed.groupId : null,
      expanded,
    }
  } catch {
    return { groupId: null, expanded: {} }
  }
}

function writeSavedState(state) {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // A full quota or a private-mode window only costs the last selection,
    // which is not worth failing the page over.
  }
}

function readIdMap(value) {
  const map = {}
  if (value === null || typeof value !== 'object') return map
  for (const [key, ids] of Object.entries(value)) {
    if (key !== '__proto__') map[key] = stringIds(ids)
  }
  return map
}

function readSavedOrder() {
  try {
    const raw = window.localStorage.getItem(ORDER_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return null
    return {
      signature: typeof parsed.signature === 'string' ? parsed.signature : '',
      groups: stringIds(parsed.groups),
      lists: readIdMap(parsed.lists),
      bookmarks: readIdMap(parsed.bookmarks),
    }
  } catch {
    return null
  }
}

function writeSavedOrder(order, signature) {
  try {
    window.localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({
        signature,
        groups: order.groups,
        lists: order.lists,
        bookmarks: order.bookmarks,
      }),
    )
  } catch {
    // Sorting still works for this session if storage is unavailable.
  }
}

module.exports = {
  readSavedState,
  writeSavedState,
  readSavedOrder,
  writeSavedOrder,
}
