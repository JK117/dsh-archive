/** Values shared by more than one browser module. */
const NS = 'dsh-archive'

/** The sidebar row, the `main` cell, and the panel's data attributes share it. */
const PANEL_ID = 'archive'

const LIBRARY_URL = '/dsh-archive/bookmarks'
const OPEN_URL = '/dsh-archive/open'
const MUTATE_URL = '/dsh-archive/mutate'

/** Selected group + collapsed lists. Keyed by the Host-provided ids. */
const STATE_KEY = 'dsh-archive:state:v2'

/**
 * Manual order per level. v3 belongs to the content-derived ids; the old
 * positional `v2` order is intentionally not migrated.
 */
const ORDER_KEY = 'dsh-archive:order:v3'

/** Touch only: a short hold separates a drag from a scroll gesture. */
const HOLD_MS = 280

/** Mouse / pen must travel this far before the source lifts and siblings fill. */
const DRAG_TRIGGER_DISTANCE = 24

/** Touch movement before the hold completes cancels the drag, so scrolling works. */
const TOUCH_SCROLL_TOLERANCE = 8

/** Mirrors the Host's MAX_DATA_BYTES; larger imports are rejected before reading. */
const MAX_IMPORT_BYTES = 8 * 1024 * 1024

/** Candy hues cycled by the left rail and the right column's group title. */
const TONE_COUNT = 8

module.exports = {
  NS,
  PANEL_ID,
  LIBRARY_URL,
  OPEN_URL,
  MUTATE_URL,
  STATE_KEY,
  ORDER_KEY,
  HOLD_MS,
  DRAG_TRIGGER_DISTANCE,
  TOUCH_SCROLL_TOLERANCE,
  MAX_IMPORT_BYTES,
  TONE_COUNT,
}
