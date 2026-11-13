/**
 * Archive (资料库) — host half.
 *
 * The panel itself is the Client module. The Host owns the things a page
 * cannot do safely on its own:
 *
 * - it reads the plugin-owned library file (`data/bookmarks.json`), validates
 *   it, and serves the normalized render model, so the page never sees raw
 *   file data and replacing the file needs no code change;
 * - it applies create / import / rename / delete / move operations with a
 *   revision check, an atomic rename, and a `bookmarks.json.bak` copy, so a
 *   failed write never damages the library;
 * - it opens a bookmark in the system browser. A `target="_blank"` anchor
 *   inside the Web GUI would open another frame of the GUI, not the user's
 *   browser, so a click goes through `POST /dsh-archive/open`.
 *
 * Implementation lives behind small modules: `lib/library.js` owns the data
 * model and the store, `lib/http.js` the request/response helpers,
 * `lib/external.js` the platform opener, and `routes.js` the handlers.
 */
import { ROUTES } from './lib/config.js'
import { handleLibrary, handleMutate, handleOpen } from './routes.js'

export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ROUTES.library,
        handler: handleLibrary,
      }),
    'archive: library route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ROUTES.open,
        handler: handleOpen,
      }),
    'archive: external open route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ROUTES.mutate,
        handler: handleMutate,
      }),
    'archive: mutate route',
  )
}
