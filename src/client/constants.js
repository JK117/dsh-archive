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

/** Mirrors the Host's rename limit, so the input can stop early. */
const MAX_NAME_LENGTH = 200

/** Candy hues cycled by the left rail and the right column's group title. */
const TONE_COUNT = 8

/**
 * The left rail's scrollbar is an overlay cue rather than permanent chrome:
 * it appears while the group list scrolls and goes away this long after the
 * last scroll event.
 */
const RAIL_SCROLLBAR_HIDE_MS = 2000

/**
 * The draggable divider between the group rail and the bookmarks column. The
 * width lives in localStorage as a plain pixel number; the minimum main-column
 * width keeps the grid readable when the panel itself is narrow.
 */
const RAIL_WIDTH_KEY = 'dsh-archive:rail:v1'
const RAIL_WIDTH_DEFAULT = 240
const RAIL_WIDTH_MIN = 160
const RAIL_WIDTH_MAX = 420
const RAIL_WIDTH_STEP = 8
const MAIN_WIDTH_MIN = 300

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
  MAX_NAME_LENGTH,
  TONE_COUNT,
  RAIL_SCROLLBAR_HIDE_MS,
  RAIL_WIDTH_KEY,
  RAIL_WIDTH_DEFAULT,
  RAIL_WIDTH_MIN,
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_STEP,
  MAIN_WIDTH_MIN,
}
