/**
 * Geometry and persistence for the draggable group-rail divider. Kept free of
 * React so the clamping rules can be smoke-tested in Node.
 */
const {
  RAIL_WIDTH_KEY,
  RAIL_WIDTH_DEFAULT,
  RAIL_WIDTH_MIN,
  RAIL_WIDTH_MAX,
  MAIN_WIDTH_MIN,
} = require('./constants.js')

/** The widest rail the body can host while the bookmarks column keeps its minimum. */
function railCeiling(bodyWidth) {
  if (!Number.isFinite(bodyWidth) || bodyWidth <= 0) return RAIL_WIDTH_MAX
  return Math.max(
    RAIL_WIDTH_MIN,
    Math.min(RAIL_WIDTH_MAX, Math.floor(bodyWidth - MAIN_WIDTH_MIN)),
  )
}

/** Rounds and clamps a candidate width; invalid values fall back to the default. */
function clampRailWidth(value, ceiling = RAIL_WIDTH_MAX) {
  const max = Math.max(RAIL_WIDTH_MIN, Math.min(RAIL_WIDTH_MAX, ceiling))
  if (!Number.isFinite(value)) return Math.min(RAIL_WIDTH_DEFAULT, max)
  return Math.min(max, Math.max(RAIL_WIDTH_MIN, Math.round(value)))
}

/** Best-effort restore; an unavailable or corrupt record simply uses the default. */
function readSavedRailWidth() {
  try {
    const raw = window.localStorage.getItem(RAIL_WIDTH_KEY)
    if (raw === null) return RAIL_WIDTH_DEFAULT
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return RAIL_WIDTH_DEFAULT
    return clampRailWidth(parsed)
  } catch {
    return RAIL_WIDTH_DEFAULT
  }
}

function writeSavedRailWidth(width) {
  try {
    window.localStorage.setItem(RAIL_WIDTH_KEY, JSON.stringify(clampRailWidth(width)))
  } catch {
    // The divider still works for this session if storage is unavailable.
  }
}

module.exports = { railCeiling, clampRailWidth, readSavedRailWidth, writeSavedRailWidth }
