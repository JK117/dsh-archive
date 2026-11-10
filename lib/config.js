/**
 * Stable locations and limits shared by the Host routes and the data loader.
 * The browser half only knows the route paths (see `src/client/constants.js`).
 */
import { fileURLToPath } from 'node:url'

/** All routes are same-origin only; see `routes.js`. */
export const ROUTES = {
  library: '/dsh-archive/bookmarks',
  open: '/dsh-archive/open',
  mutate: '/dsh-archive/mutate',
}

/** The one data file the panel reads and writes. Replacing it needs no code change. */
export const DATA_FILE = fileURLToPath(new URL('../data/bookmarks.json', import.meta.url))

/** Refuse an accidentally huge file instead of buffering it all. */
export const MAX_DATA_BYTES = 8 * 1024 * 1024

/** The open route only accepts a small `{ "url": "..." }` body. */
export const MAX_BODY_BYTES = 8 * 1024

/** A batch delete / move request can carry up to this many ids. */
export const MAX_MUTATE_IDS = 500

/**
 * The mutate route also carries JSON imports, so its body may be as large as
 * the library file itself. `open` keeps its much smaller limit.
 */
export const MAX_MUTATE_BYTES = MAX_DATA_BYTES
