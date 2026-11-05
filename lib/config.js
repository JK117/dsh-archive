/**
 * Stable locations and limits shared by the Host routes and the data loader.
 * The browser half only knows the two route paths (see `src/client/constants.js`).
 */
import { fileURLToPath } from 'node:url'

/** Both routes are same-origin only; see `routes.js`. */
export const ROUTES = {
  library: '/dsh-archive/bookmarks',
  open: '/dsh-archive/open',
}

/** The one data file the panel reads. Replacing it needs no code change. */
export const DATA_FILE = fileURLToPath(new URL('../data/bookmarks.json', import.meta.url))

/** Refuse an accidentally huge file instead of buffering it all. */
export const MAX_DATA_BYTES = 8 * 1024 * 1024

/** The open route only accepts a small `{ "url": "..." }` body. */
export const MAX_BODY_BYTES = 8 * 1024
