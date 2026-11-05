/** Values shared by more than one browser module. */
const NS = 'dsh-archive'

/** The sidebar row, the `main` cell, and the panel's data attributes share it. */
const PANEL_ID = 'archive'

const LIBRARY_URL = '/dsh-archive/bookmarks'
const OPEN_URL = '/dsh-archive/open'

/** Selected group + collapsed lists. Keyed by the Host-provided ids. */
const STATE_KEY = 'dsh-archive:state:v1'

/**
 * Manual order per level. v2 stores `bookmarks` (the data model's name) rather
 * than the old render-only `cards`.
 */
const ORDER_KEY = 'dsh-archive:order:v2'

/** Touch only: a short hold separates a drag from a scroll gesture. */
const HOLD_MS = 280

/** Mouse / pen must travel this far before the source lifts and siblings fill. */
const DRAG_TRIGGER_DISTANCE = 24

/** Touch movement before the hold completes cancels the drag, so scrolling works. */
const TOUCH_SCROLL_TOLERANCE = 8

/** Candy hues cycled by the left rail and the right column's group title. */
const TONE_COUNT = 8

module.exports = {
  NS,
  PANEL_ID,
  LIBRARY_URL,
  OPEN_URL,
  STATE_KEY,
  ORDER_KEY,
  HOLD_MS,
  DRAG_TRIGGER_DISTANCE,
  TOUCH_SCROLL_TOLERANCE,
  TONE_COUNT,
}
