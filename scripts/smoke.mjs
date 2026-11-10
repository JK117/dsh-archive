/**
 * Dependency-free smoke checks for the parts that do not need a browser:
 * the data model, the bundled client graph and its registrations, the order
 * helpers, local storage, and the route validation paths.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { createLibraryStore, normalizeImport, normalizeLibrary } from '../lib/library.js'
import { handleLibrary, handleMutate, handleOpen } from '../routes.js'

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

  const expectedStats = {
    groups: raw.groups.length,
    lists: raw.groups.reduce((total, group) => total + group.lists.length, 0),
    bookmarks: raw.groups.reduce(
      (total, group) =>
        total + group.lists.reduce((count, list) => count + list.bookmarks.length, 0),
      0,
    ),
  }
  const library = normalizeLibrary(raw)
  assert.deepEqual(library.stats, expectedStats)
  assert.match(library.groups[0].id, /^g_[A-Za-z0-9_-]+$/)
  assert.match(library.groups[0].lists[0].id, /^l_[A-Za-z0-9_-]+$/)
  assert.match(library.groups[0].lists[0].bookmarks[0].id, /^b_[A-Za-z0-9_-]+$/)
  assert.equal(library.groups[0].lists[0].count, library.groups[0].lists[0].bookmarks.length)
}

async function testEmptyStructures() {
  const library = normalizeLibrary({
    groups: [
      { name: 'Empty group', lists: [] },
      {
        name: 'Mixed',
        lists: [
          { title: 'Empty list', bookmarks: [] },
          { title: 'One', bookmarks: [{ title: 'A', url: 'https://a.example/' }] },
        ],
      },
    ],
  })
  assert.deepEqual(library.stats, { groups: 2, lists: 2, bookmarks: 1 })
  assert.equal(library.groups[0].lists.length, 0)
  assert.equal(library.groups[1].lists[0].count, 0)
  assert.equal(library.groups[1].lists[0].bookmarks.length, 0)

  const empty = normalizeLibrary({ groups: [] })
  assert.deepEqual(empty.stats, { groups: 0, lists: 0, bookmarks: 0 })
  assert.deepEqual(empty.groups, [])

  const duplicate = normalizeLibrary({
    groups: [
      {
        name: 'Dup',
        lists: [
          {
            title: 'Same',
            bookmarks: [
              { title: 'A', url: 'https://a.example/' },
              { title: 'A', url: 'https://a.example/' },
            ],
          },
        ],
      },
    ],
  })
  const ids = duplicate.groups[0].lists[0].bookmarks.map((bookmark) => bookmark.id)
  assert.equal(new Set(ids).size, 2)
}

async function testImportCleaning() {
  const imported = normalizeImport({
    version: 4,
    groups: [
      {
        name: 'Import - CSS',
        type: 'public',
        lists: [
          {
            title: 'Positioning',
            labelIds: ['x'],
            cards: [
              {
                title: 'Plain',
                url: 'https://plain.example/',
                favIconUrl: 'https://plain.example/f.ico',
                customTitle: '',
                customDescription: 'ignored',
                description: 'ignored',
              },
              {
                title: 'Old',
                url: 'https://old.example/',
                customTitle: 'Custom old',
                favIconUrl: 'javascript:alert(1)',
                description: 'ignored',
              },
              { title: 'Bad', url: 'file:///etc/passwd' },
              { url: 'https://fallback.example/' },
            ],
          },
          { title: 'Empty', cards: [] },
          { title: '', cards: [{ title: 'Lost', url: 'https://lost.example/' }] },
        ],
      },
      {
        name: 'Modern',
        lists: [
          {
            title: 'Bookmarks',
            bookmarks: [
              {
                title: 'Modern',
                url: 'https://modern.example/',
                icon: 'https://modern.example/f.ico',
                tags: ['ignored'],
              },
            ],
          },
        ],
      },
      { name: '', lists: [] },
      { name: 'No lists', type: 'public' },
    ],
  })

  assert.deepEqual(imported.skipped, { groups: 2, lists: 1, bookmarks: 1 })
  assert.equal(imported.groups.length, 2)
  assert.equal(imported.groups[0].name, 'CSS')
  assert.equal(imported.groups[0].lists[0].bookmarks.length, 3)
  assert.deepEqual(imported.groups[0].lists[0].bookmarks[0], {
    title: 'Plain',
    url: 'https://plain.example/',
    icon: 'https://plain.example/f.ico',
  })
  assert.equal(imported.groups[0].lists[0].bookmarks[1].title, 'Custom old')
  assert.equal('icon' in imported.groups[0].lists[0].bookmarks[1], false)
  assert.equal(imported.groups[0].lists[0].bookmarks[2].title, 'https://fallback.example/')
  assert.equal(imported.groups[0].lists[1].bookmarks.length, 0)
  assert.equal(imported.groups[1].lists[0].bookmarks[0].title, 'Modern')

  const serialized = JSON.stringify(imported)
  for (const field of [
    'version',
    'favIconUrl',
    'customTitle',
    'customDescription',
    'description',
    'labelIds',
    'tags',
    'type',
  ]) {
    assert.equal(serialized.includes('"' + field + '"'), false)
  }

  let invalid = null
  try {
    normalizeImport({ groups: 'nope' })
  } catch (error) {
    invalid = error
  }
  assert.equal(invalid?.status, 400)
  assert.equal(invalid?.code, 'invalid-import')
}

async function testStableIds() {  const raw = {
    groups: [
      {
        name: 'CSS',
        lists: [
          {
            title: 'Positioning',
            bookmarks: [
              { title: 'A', url: 'https://a.example/' },
              { title: 'B', url: 'https://b.example/' },
              { title: 'C', url: 'https://c.example/' },
            ],
          },
          {
            title: 'Flex',
            bookmarks: [{ title: 'D', url: 'https://d.example/' }],
          },
        ],
      },
    ],
  }
  const before = normalizeLibrary(raw)
  const idsBefore = before.groups[0].lists[0].bookmarks.map((bookmark) => bookmark.id)

  raw.groups[0].lists[0].bookmarks.splice(0, 1)
  const after = normalizeLibrary(raw)
  const idsAfter = after.groups[0].lists[0].bookmarks.map((bookmark) => bookmark.id)
  assert.deepEqual(idsAfter, idsBefore.slice(1))
  assert.equal(after.groups[0].lists[1].bookmarks[0].id, before.groups[0].lists[1].bookmarks[0].id)
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

async function testStyles() {
  const { CSS } = requireFromSource('./styles.js')
  // A typo in a theme token silently falls back to the inherited colour, which
  // is how the delete actions once lost their red. Guard the semantic token.
  assert.match(CSS, /--ar-danger:var\(--dsw-alias-state-error-primary\)/)
  assert.doesNotMatch(CSS, /--dsw-alias-label-error/)
  // Card layout: three title lines, and one centred row for favicon / checkbox / trash.
  assert.match(CSS, /\.ar-card\{[^}]*align-items:center/)
  assert.match(CSS, /\.ar-card\{[^}]*min-height:76px/)
  assert.match(CSS, /\.ar-card__title\{[^}]*-webkit-line-clamp:3/)
  assert.match(CSS, /\.ar-card__trash\{[^}]*top:50%/)
  assert.match(CSS, /\.ar-card__trash\{[^}]*translateY\(-50%\)/)
}

async function testOrderHelpers() {
  const { applyOrder, moveId, collectionSignature, pruneOrder } = requireFromSource('./order.js')

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

  const keptId = collection.groups[0].lists[0].bookmarks[0].id
  const pruned = pruneOrder(
    { groups: [], lists: {}, bookmarks: { 'g0-l0': [keptId, 'b_gone'] } },
    collection,
  )
  assert.deepEqual(pruned.bookmarks['g0-l0'], [keptId])
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

async function testMutations() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-archive-smoke-'))
  const file = path.join(dir, 'bookmarks.json')
  try {
    const fixture = {
      groups: [
        { name: 'Empty group', lists: [] },
        {
          name: 'B',
          lists: [
            {
              title: 'one',
              bookmarks: [
                { title: 'x', url: 'https://x.example/' },
                { title: 'y', url: 'https://y.example/' },
              ],
            },
            { title: 'empty', bookmarks: [] },
          ],
        },
      ],
    }
    await writeFile(file, JSON.stringify(fixture, null, 2))

    const store = createLibraryStore(file)
    const first = await store.load()
    assert.equal(first.capabilities.mutate, true)
    assert.deepEqual(first.stats, { groups: 2, lists: 2, bookmarks: 2 })

    const xId = first.groups[1].lists[0].bookmarks[0].id
    const yId = first.groups[1].lists[0].bookmarks[1].id
    const emptyListId = first.groups[1].lists[1].id
    const groupId = first.groups[1].id

    const afterDelete = await store.mutate({ type: 'delete', ids: [xId] }, first.revision)
    assert.deepEqual(afterDelete.stats, { groups: 2, lists: 2, bookmarks: 1 })
    assert.equal(afterDelete.groups[0].lists.length, 0)
    assert.equal(afterDelete.groups[1].lists[0].bookmarks[0].id, yId)
    assert.equal(afterDelete.groups[1].lists[1].bookmarks.length, 0)

    const afterMove = await store.mutate(
      { type: 'move', ids: [yId], target: { groupId, listId: emptyListId } },
      afterDelete.revision,
    )
    assert.deepEqual(afterMove.stats, { groups: 2, lists: 2, bookmarks: 1 })
    assert.equal(afterMove.groups[1].lists[0].bookmarks.length, 0)
    assert.equal(afterMove.groups[1].lists[1].bookmarks[0].title, 'y')
    assert.equal(afterMove.groups[0].lists.length, 0)

    const disk = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(disk.groups[0].lists.length, 0)
    assert.equal(disk.groups[1].lists[0].bookmarks.length, 0)
    assert.equal(disk.groups[1].lists[1].bookmarks[0].title, 'y')
    assert.ok((await readFile(file + '.bak', 'utf8')).includes('Empty group'))

    let stale = null
    try {
      await store.mutate({ type: 'delete', ids: [yId] }, first.revision)
    } catch (error) {
      stale = error
    }
    assert.equal(stale?.status, 409)
    assert.equal(stale?.code, 'stale-library')
    assert.ok(stale?.library)

    let noop = null
    const movedId = afterMove.groups[1].lists[1].bookmarks[0].id
    try {
      await store.mutate(
        { type: 'move', ids: [movedId], target: { groupId, listId: emptyListId } },
        afterMove.revision,
      )
    } catch (error) {
      noop = error
    }
    assert.equal(noop?.status, 400)
    assert.equal(noop?.code, 'no-op')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function testCreateAndImport() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-archive-write-'))
  const file = path.join(dir, 'bookmarks.json')
  try {
    await writeFile(
      file,
      JSON.stringify(
        {
          groups: [
            {
              name: 'A',
              lists: [
                {
                  title: 'L',
                  bookmarks: [{ title: 'x', url: 'https://x.example/' }],
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    )

    const store = createLibraryStore(file)
    const first = await store.load()
    const groupId = first.groups[0].id
    const listId = first.groups[0].lists[0].id

    const created = await store.mutate(
      {
        type: 'create',
        target: { groupId, listId },
        bookmark: { url: 'https://y.example', title: ' Y ' },
      },
      first.revision,
    )
    assert.deepEqual(created.stats, { groups: 1, lists: 1, bookmarks: 2 })
    assert.equal(created.created.groupId, groupId)
    assert.equal(created.created.listId, listId)
    assert.match(created.created.bookmarkId, /^b_/)
    assert.equal(
      created.groups[0].lists[0].bookmarks.find((bookmark) => bookmark.id === created.created.bookmarkId)
        ?.title,
      'Y',
    )

    const added = await store.mutate(
      {
        type: 'create',
        target: { groupName: 'New', listTitle: 'Fresh' },
        bookmark: { url: 'https://new.example/' },
      },
      created.revision,
    )
    assert.deepEqual(added.stats, { groups: 2, lists: 2, bookmarks: 3 })
    const newGroup = added.groups.find((group) => group.name === 'New')
    const newList = newGroup?.lists.find((list) => list.title === 'Fresh')
    assert.equal(added.created.groupId, newGroup?.id)
    assert.equal(added.created.listId, newList?.id)
    assert.equal(newList?.bookmarks[0].title, 'https://new.example/')

    let duplicate = null
    try {
      await store.mutate(
        {
          type: 'create',
          target: { groupId, listId },
          bookmark: { url: 'https://y.example' },
        },
        added.revision,
      )
    } catch (error) {
      duplicate = error
    }
    assert.equal(duplicate?.status, 409)
    assert.equal(duplicate?.code, 'duplicate-bookmark')

    const imported = await store.mutate(
      {
        type: 'import',
        data: {
          version: 4,
          groups: [
            {
              name: 'A',
              type: 'public',
              lists: [
                {
                  title: 'L',
                  labelIds: [],
                  cards: [
                    {
                      title: 'Y again',
                      url: 'https://y.example/',
                      favIconUrl: 'https://y.example/f.ico',
                    },
                    {
                      title: 'Z',
                      url: 'https://z.example/',
                      customTitle: 'Zed',
                      description: 'ignored',
                    },
                    { title: 'Bad', url: 'javascript:alert(1)' },
                  ],
                },
                {
                  title: 'Imported list',
                  cards: [{ title: 'I', url: 'https://i.example/' }],
                },
              ],
            },
            {
              name: 'Imported group',
              lists: [
                {
                  title: 'Only',
                  bookmarks: [{ title: 'O', url: 'https://o.example/' }],
                },
              ],
            },
          ],
        },
      },
      added.revision,
    )
    assert.deepEqual(imported.imported, {
      groups: 1,
      lists: 2,
      bookmarks: 3,
      duplicates: 1,
      skipped: 2,
    })
    assert.deepEqual(imported.stats, { groups: 3, lists: 4, bookmarks: 6 })

    const diskText = await readFile(file, 'utf8')
    for (const field of [
      'favIconUrl',
      'customTitle',
      'customDescription',
      'description',
      'labelIds',
      '"type"',
      '"version"',
      '"cards"',
    ]) {
      assert.equal(diskText.includes(field), false)
    }
    const disk = JSON.parse(diskText)
    const importedList = disk.groups
      .find((group) => group.name === 'A')
      .lists.find((list) => list.title === 'Imported list')
    assert.deepEqual(importedList.bookmarks, [
      { title: 'I', url: 'https://i.example/' },
    ])

    const again = await store.mutate(
      {
        type: 'import',
        data: {
          groups: [
            {
              name: 'A',
              lists: [
                {
                  title: 'L',
                  bookmarks: [
                    { title: 'Y again', url: 'https://y.example/' },
                    { title: 'Z', url: 'https://z.example/' },
                  ],
                },
              ],
            },
          ],
        },
      },
      imported.revision,
    )
    assert.equal(again.imported.bookmarks, 0)
    assert.equal(again.imported.groups, 0)
    assert.equal(again.imported.lists, 0)
    assert.equal(again.imported.duplicates, 2)
    assert.deepEqual(again.stats, imported.stats)
    assert.equal(await readFile(file, 'utf8'), diskText)

    let invalid = null
    try {
      await store.mutate({ type: 'import', data: { groups: 'nope' } }, again.revision)
    } catch (error) {
      invalid = error
    }
    assert.equal(invalid?.status, 400)
    assert.equal(invalid?.code, 'invalid-import')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function testSelectionHelpers() {
  const {
    toggleId,
    selectedEntries,
    countsByGroup,
    groupCount,
    hiddenByQuery,
    targetStats,
  } = requireFromSource('./selection.js')
  const { emptyOrder } = requireFromSource('./order.js')

  const groups = [
    {
      id: 'g1',
      name: 'One',
      lists: [
        {
          id: 'l1',
          title: 'Alpha list',
          bookmarks: [
            { id: 'b1', title: 'Alpha', url: 'https://a.example/' },
            { id: 'b2', title: 'Beta', url: 'https://b.example/' },
          ],
        },
        {
          id: 'l2',
          title: 'Gamma list',
          bookmarks: [{ id: 'b3', title: 'Gamma', url: 'https://g.example/' }],
        },
      ],
    },
    {
      id: 'g2',
      name: 'Two',
      lists: [
        {
          id: 'l3',
          title: 'Delta list',
          bookmarks: [{ id: 'b4', title: 'Delta', url: 'https://d.example/' }],
        },
      ],
    },
  ]

  let selected = new Set()
  selected = toggleId(selected, 'b1')
  selected = toggleId(selected, 'b3')
  selected = toggleId(selected, 'b4')
  assert.deepEqual([...selected], ['b1', 'b3', 'b4'])
  assert.deepEqual([...toggleId(selected, 'b3')], ['b1', 'b4'])

  const entries = selectedEntries(groups, emptyOrder(), selected)
  assert.deepEqual(entries.map((entry) => entry.bookmark.id), ['b1', 'b3', 'b4'])
  assert.deepEqual([...countsByGroup(entries)], [['g1', 2], ['g2', 1]])
  assert.equal(groupCount(entries), 2)
  assert.equal(hiddenByQuery(entries, 'gamma'), 2)
  assert.deepEqual(targetStats(entries, 'l1'), { total: 3, inTarget: 1, moving: 2 })
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
  const libraryPayload = JSON.parse(libraryResponse.body)
  const rawLibrary = JSON.parse(
    (await readFile(path.join(ROOT, 'data', 'bookmarks.json'), 'utf8')).replace(/^\uFEFF/, ''),
  )
  assert.deepEqual(libraryPayload.stats, normalizeLibrary(rawLibrary).stats)
  assert.match(libraryPayload.revision, /^[a-f0-9]{16}$/)
  assert.equal(typeof libraryPayload.capabilities.mutate, 'boolean')

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

  const mutateCrossOrigin = response()
  await handleMutate(
    request({
      method: 'POST',
      headers: { origin: 'https://evil.example', host: '127.0.0.1', 'content-type': 'application/json' },
      body: '{}',
    }),
    mutateCrossOrigin,
  )
  await mutateCrossOrigin.finished
  assert.equal(mutateCrossOrigin.status, 403)

  const mutateWrongType = response()
  await handleMutate(
    request({ method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }),
    mutateWrongType,
  )
  await mutateWrongType.finished
  assert.equal(mutateWrongType.status, 415)

  const mutateInvalidJson = response()
  await handleMutate(
    request({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }),
    mutateInvalidJson,
  )
  await mutateInvalidJson.finished
  assert.equal(mutateInvalidJson.status, 400)
  assert.deepEqual(JSON.parse(mutateInvalidJson.body), { error: 'invalid-json' })

  const mutateInvalidOp = response()
  await handleMutate(
    request({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: '', op: { type: 'nope', ids: ['x'] } }),
    }),
    mutateInvalidOp,
  )
  await mutateInvalidOp.finished
  assert.equal(mutateInvalidOp.status, 400)
  assert.deepEqual(JSON.parse(mutateInvalidOp.body), { error: 'invalid-op' })

  const mutateUnknown = response()
  await handleMutate(
    request({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: '', op: { type: 'delete', ids: ['b_missing'] } }),
    }),
    mutateUnknown,
  )
  await mutateUnknown.finished
  assert.equal(mutateUnknown.status, 404)
  assert.deepEqual(JSON.parse(mutateUnknown.body), { error: 'unknown-bookmark' })

  const createInvalidUrl = response()
  await handleMutate(
    request({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: '',
        op: {
          type: 'create',
          bookmark: { url: 'javascript:alert(1)' },
          target: { groupName: 'X', listTitle: 'Y' },
        },
      }),
    }),
    createInvalidUrl,
  )
  await createInvalidUrl.finished
  assert.equal(createInvalidUrl.status, 400)
  assert.deepEqual(JSON.parse(createInvalidUrl.body), { error: 'invalid-url' })

  const importInvalidShape = response()
  await handleMutate(
    request({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: '',
        op: { type: 'import', data: { groups: 'nope' } },
      }),
    }),
    importInvalidShape,
  )
  await importInvalidShape.finished
  assert.equal(importInvalidShape.status, 400)
  assert.deepEqual(JSON.parse(importInvalidShape.body), { error: 'invalid-import' })
}

await test('data model', testDataModel)
await test('empty structures', testEmptyStructures)
await test('import cleaning', testImportCleaning)
await test('stable ids', testStableIds)
await test('mutations', testMutations)
await test('create and import', testCreateAndImport)
await test('client bundle', testClientBundle)
await test('styles', testStyles)
await test('order helpers', testOrderHelpers)
await test('selection helpers', testSelectionHelpers)
await test('local storage', testStorage)
await test('routes', testRoutes)
console.log('smoke: all checks passed')
