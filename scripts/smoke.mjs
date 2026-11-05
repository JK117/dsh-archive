/**
 * Dependency-free smoke checks for the parts that do not need a browser:
 * the data model, the bundled client graph and its registrations, the order
 * helpers, local storage, and the route validation paths.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { normalizeLibrary } from '../lib/library.js'
import { handleLibrary, handleOpen } from '../routes.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const requireFromSource = createRequire(path.join(ROOT, 'src', 'client', 'index.js'))

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok - ${name}`))
    .catch((error) => {
      console.error(`not ok - ${name}`)
      throw error
    })
}

async function testDataModel() {
  const raw = JSON.parse((await readFile(path.join(ROOT, 'data', 'bookmarks.json'), 'utf8')).replace(/^\uFEFF/, ''))
  assert.deepEqual(Object.keys(raw), ['groups'])

  for (const group of raw.groups) {
    assert.deepEqual(Object.keys(group).sort(), ['lists', 'name'])
    for (const list of group.lists) {
      assert.deepEqual(Object.keys(list).sort(), ['bookmarks', 'title'])
      for (const bookmark of list.bookmarks) {
        const keys = Object.keys(bookmark).sort()
        assert.deepEqual(keys, keys.includes('icon') ? ['icon', 'title', 'url'] : ['title', 'url'])
        assert.equal(typeof bookmark.title, 'string')
        assert.match(bookmark.url, /^https?:\/\//)
        if ('icon' in bookmark) assert.match(bookmark.icon, /^https?:\/\//)
      }
    }
  }

  const library = normalizeLibrary(raw)
  assert.deepEqual(library.stats, { groups: 13, lists: 55, bookmarks: 153 })
  assert.equal(library.groups[0].id, 'g0')
  assert.equal(library.groups[0].lists[0].id, 'g0-l0')
  assert.equal(library.groups[0].lists[0].bookmarks[0].id, 'g0-l0-b0')
  assert.equal(library.groups[0].lists[0].count, library.groups[0].lists[0].bookmarks.length)
}

async function testClientBundle() {
  let registration = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) {
          registration = value
        },
      },
    },
    console,
  }
  vm.runInNewContext(await readFile(path.join(ROOT, 'client.js'), 'utf8'), sandbox)

  assert.equal(registration?.id, 'dsh-archive')
  assert.equal(typeof registration.factory, 'function')

  const ReactStub = {
    createElement: () => null,
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useRef: (value) => ({ current: value }),
  }
  const client = registration.factory((specifier) => {
    if (specifier === 'react') return ReactStub
    throw new Error(`unexpected external require: ${specifier}`)
  })
  assert.equal(typeof client.apply, 'function')
  assert.deepEqual(Array.from(client.inject), ['slots', 'locale'])

  const seen = []
  const ctx = {
    effect(fn) {
      fn()
    },
    locale: {
      register(namespace, dictionaries) {
        seen.push(['locale', namespace])
        assert.deepEqual(Object.keys(dictionaries.zh), Object.keys(dictionaries.en))
        return () => {}
      },
      bind() {
        return (key) => key
      },
    },
    slots: {
      inject(name, callback) {
        callback()
        return () => {}
      },
      register(options, component) {
        seen.push(['slot', options.name, options.id ?? options.key, component])
        return () => {}
      },
    },
  }
  client.apply(ctx)

  const main = seen.find((entry) => entry[0] === 'slot' && entry[1] === 'main')
  const sidebar = seen.find((entry) => entry[0] === 'slot' && entry[1] === 'sidebar.panellist')
  assert.ok(main && typeof main[3] === 'function')
  assert.equal(main[2], 'archive')
  assert.ok(sidebar && typeof sidebar[3] === 'function')
  assert.equal(sidebar[2], 'archive')
}

async function testOrderHelpers() {
  const { applyOrder, moveId, collectionSignature } = requireFromSource('./order.js')

  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.deepEqual(applyOrder(items, ['c', 'a']).map((item) => item.id), ['c', 'a', 'b'])
  assert.deepEqual(applyOrder(items, []).map((item) => item.id), ['a', 'b', 'c'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 0, 3), ['b', 'c', 'a'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
  assert.deepEqual(moveId(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c'])

  const collection = {
    groups: [
      {
        id: 'g0',
        name: 'CSS',
        lists: [
          {
            id: 'g0-l0',
            title: 'Positioning',
            bookmarks: [{ id: 'g0-l0-b0', title: 'px', url: 'https://example.com/', icon: 'https://a/' }],
          },
        ],
      },
    ],
  }
  const signature = collectionSignature(collection)
  const iconChanged = structuredClone(collection)
  iconChanged.groups[0].lists[0].bookmarks[0].icon = 'https://b/'
  assert.equal(collectionSignature(iconChanged), signature)
  iconChanged.groups[0].lists[0].bookmarks[0].title = 'em'
  assert.notEqual(collectionSignature(iconChanged), signature)
}

async function testStorage() {
  const store = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
  }
  try {
    const { readSavedState, writeSavedState, readSavedOrder, writeSavedOrder } =
      requireFromSource('./storage.js')

    writeSavedState({ groupId: 'g1', expanded: { 'g1-l0': false } })
    assert.deepEqual(readSavedState(), { groupId: 'g1', expanded: { 'g1-l0': false } })

    writeSavedOrder({ groups: ['g1'], lists: { g1: ['g1-l0'] }, bookmarks: { 'g1-l0': ['x'] } }, 'sig')
    const order = readSavedOrder()
    assert.equal(order.signature, 'sig')
    assert.deepEqual(order.groups, ['g1'])
    assert.deepEqual(order.lists, { g1: ['g1-l0'] })
    assert.deepEqual(order.bookmarks, { 'g1-l0': ['x'] })
  } finally {
    delete globalThis.window
  }
}

function request({ method = 'GET', headers = {}, body = null } = {}) {
  const stream = body === null ? new Readable({ read() {} }) : Readable.from([Buffer.from(body)])
  stream.method = method
  stream.headers = headers
  return stream
}

function response() {
  let done
  const finished = new Promise((resolve) => {
    done = resolve
  })
  return {
    status: 0,
    body: '',
    headers: {},
    headersSent: false,
    writableEnded: false,
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(body) {
      this.body = body ?? ''
      this.writableEnded = true
      done()
    },
    finished,
  }
}

async function testRoutes() {
  const libraryResponse = response()
  await handleLibrary(request(), libraryResponse)
  await libraryResponse.finished
  assert.equal(libraryResponse.status, 200)
  assert.deepEqual(JSON.parse(libraryResponse.body).stats, {
    groups: 13,
    lists: 55,
    bookmarks: 153,
  })

  const wrongMethod = response()
  await handleLibrary(request({ method: 'POST' }), wrongMethod)
  await wrongMethod.finished
  assert.equal(wrongMethod.status, 405)

  const crossOrigin = response()
  await handleOpen(
    request({ method: 'POST', headers: { origin: 'https://evil.example', host: '127.0.0.1' } }),
    crossOrigin,
  )
  await crossOrigin.finished
  assert.equal(crossOrigin.status, 403)

  const wrongType = response()
  await handleOpen(
    request({ method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }),
    wrongType,
  )
  await wrongType.finished
  assert.equal(wrongType.status, 415)

  const invalidUrl = response()
  await handleOpen(
    request({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    }),
    invalidUrl,
  )
  await invalidUrl.finished
  assert.equal(invalidUrl.status, 400)
  assert.deepEqual(JSON.parse(invalidUrl.body), { error: 'invalid-url' })
}

await test('data model', testDataModel)
await test('client bundle', testClientBundle)
await test('order helpers', testOrderHelpers)
await test('local storage', testStorage)
await test('routes', testRoutes)
console.log('smoke: all checks passed')
