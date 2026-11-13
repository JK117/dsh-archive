/**
 * Dependency-free smoke checks for the parts that do not need a browser:
 * the data model, the bundled client graph and its registrations, the order
 * helpers, local storage, and the route validation paths.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
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
  // P1: long group lists scroll instead of shrinking every row; both main
  // navigation surfaces have a visible hover background.
  assert.match(CSS, /\.ar-group\{[^}]*flex:0 0 32px/)
  assert.match(CSS, /\.ar-group:hover\{[^}]*interactive-bg-hover/)
  assert.match(CSS, /button\.ar-sec__head:hover[^}]*interactive-bg-hover/)
  // Card layout: three title lines, and one centred row for favicon / checkbox / trash.
  assert.match(CSS, /\.ar-card\{[^}]*align-items:center/)
  assert.match(CSS, /\.ar-card\{[^}]*min-height:76px/)
  assert.match(CSS, /\.ar-card\{[^}]*border:0/)
  assert.match(CSS, /\.ar-card\{[^}]*box-shadow:var\(--dsw-shadow-lv1\)/)
  assert.match(CSS, /\.ar-card__title\{[^}]*-webkit-line-clamp:3/)
  assert.match(CSS, /\.ar-card__trash\{[^}]*top:50%/)
  assert.match(CSS, /\.ar-card__trash\{[^}]*translateY\(-50%\)/)
  // The shared row menu: a compact trigger and the host menu material, with a
  // danger item that reuses the same red token as every other delete action.
  assert.match(CSS, /\.ar-more__trigger\{[^}]*width:22px/)
  assert.match(CSS, /\.ar-menu\{[^}]*--dsw-menu-surface-fill/)
  assert.match(CSS, /\.ar-menu__item\[data-danger="true"\]\{[^}]*var\(--ar-danger\)/)
  assert.match(CSS, /\.ar-sec__tools\{[^}]*position:absolute/)
  assert.doesNotMatch(CSS, /\.ar-sec__tools\{[^}]*transform/)
  assert.match(CSS, /\.ar-sec__tools\{[^}]*right:16px/)
  assert.doesNotMatch(CSS, /\.ar-main__actions \.ar-more__trigger\{[^}]*width:26px/)
  assert.match(CSS, /\.ar-sec__head\{[^}]*padding:0 64px/)
  assert.doesNotMatch(CSS, /\.ar-sec__count\{[^}]*margin-left:auto/)
  assert.match(CSS, /\.ar-menu__item\{[^}]*height:28px/)
  assert.match(CSS, /@media \(hover:hover\)\{[^}]*\.ar-more__trigger:hover/)
  assert.doesNotMatch(CSS, /\.ar-main__select/)
  assert.match(CSS, /@media \(pointer:coarse\)\{\.ar-resizer\{width:18px\}\.ar-card__check\{opacity:1/)
  assert.doesNotMatch(CSS, /\.ar-sec__add\{[^}]*position:absolute/)
  // Split handle: the rail no longer draws its own border; the handle's line
  // is the divider and the body is its positioning context.
  assert.match(CSS, /\.ar-body\{[^}]*position:relative/)
  assert.match(CSS, /\.ar-resizer\{[^}]*left:var\(--ar-rail-width\)/)
  assert.match(CSS, /\.ar-resizer\{[^}]*cursor:col-resize/)
  assert.doesNotMatch(CSS, /\.ar-side\{[^}]*border-right/)
}

async function testRailSizing() {
  const { clampRailWidth, railCeiling } = requireFromSource('./rail.js')
  assert.equal(clampRailWidth(100), 160)
  assert.equal(clampRailWidth(1000), 420)
  assert.equal(clampRailWidth(300, 200), 200)
  assert.equal(clampRailWidth(300, 100), 160)
  assert.equal(clampRailWidth('wide'), 240)
  assert.equal(railCeiling(1000), 420)
  assert.equal(railCeiling(600), 300)
  assert.equal(railCeiling(320), 160)
  assert.equal(railCeiling(0), 420)
  assert.equal(railCeiling(Number.NaN), 420)
}

async function testOrderHelpers() {
  const { applyOrder, moveId, collectionSignature, pruneOrder, pruneExpanded } =
    requireFromSource('./order.js')

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
  const fullyPruned = pruneOrder(
    {
      groups: ['g_gone', 'g0'],
      lists: { g0: ['l_gone', 'g0-l0'], g_gone: ['l_gone'] },
      bookmarks: { 'g0-l0': [keptId, 'b_gone'], l_gone: ['b_gone'] },
    },
    collection,
  )
  assert.deepEqual(fullyPruned.groups, ['g0'])
  assert.deepEqual(fullyPruned.lists, { g0: ['g0-l0'] })
  assert.deepEqual(fullyPruned.bookmarks, { 'g0-l0': [keptId] })
  assert.deepEqual(
    pruneExpanded({ 'g0-l0': false, 'l_gone': true }, collection),
    { 'g0-l0': false },
  )
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

    const { readSavedRailWidth, writeSavedRailWidth } = requireFromSource('./rail.js')
    assert.equal(readSavedRailWidth(), 240)
    writeSavedRailWidth(300)
    assert.equal(readSavedRailWidth(), 300)
    writeSavedRailWidth(999)
    assert.equal(readSavedRailWidth(), 420)
    store.set('dsh-archive:rail:v1', 'null')
    assert.equal(readSavedRailWidth(), 240)
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

async function testStructureMutations() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-archive-structure-'))
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
                  bookmarks: [
                    { title: 'x', url: 'https://x.example/' },
                    { title: 'y', url: 'https://y.example/' },
                  ],
                },
                { title: 'M', bookmarks: [{ title: 'z', url: 'https://z.example/' }] },
              ],
            },
            { name: 'B', lists: [{ title: 'N', bookmarks: [] }] },
          ],
        },
        null,
        2,
      ),
    )

    const store = createLibraryStore(file)
    const first = await store.load()
    const groupA = first.groups[0]
    const listL = groupA.lists[0]
    const oldBookmarkIds = listL.bookmarks.map((bookmark) => bookmark.id)

    const renamedList = await store.mutate(
      { type: 'rename-list', groupId: groupA.id, listId: listL.id, title: 'L2' },
      first.revision,
    )
    assert.equal(renamedList.renamed.kind, 'list')
    assert.notEqual(renamedList.renamed.listId, listL.id)
    assert.deepEqual(renamedList.renamed.bookmarks.map((pair) => pair.from), oldBookmarkIds)
    assert.ok(renamedList.renamed.bookmarks.every((pair) => pair.from !== pair.to))
    assert.equal(
      renamedList.groups[0].lists.find((list) => list.id === renamedList.renamed.listId).title,
      'L2',
    )

    const renamedGroup = await store.mutate(
      { type: 'rename-group', groupId: groupA.id, name: 'A2' },
      renamedList.revision,
    )
    assert.equal(renamedGroup.renamed.kind, 'group')
    assert.notEqual(renamedGroup.renamed.groupId, groupA.id)
    assert.equal(renamedGroup.renamed.lists.length, 2)
    assert.equal(renamedGroup.renamed.bookmarks.length, 3)
    const newGroup = renamedGroup.groups.find(
      (group) => group.id === renamedGroup.renamed.groupId,
    )
    assert.equal(newGroup.name, 'A2')

    const newListM = newGroup.lists.find((list) => list.title === 'M')
    await expectError(
      { type: 'rename-group', groupId: newGroup.id, name: 'B' },
      renamedGroup.revision,
      409,
      'duplicate-group',
    )
    await expectError(
      { type: 'rename-list', groupId: newGroup.id, listId: newListM.id, title: 'L2' },
      renamedGroup.revision,
      409,
      'duplicate-list',
    )

    const afterListDelete = await store.mutate(
      { type: 'delete-list', groupId: newGroup.id, listId: newListM.id },
      renamedGroup.revision,
    )
    assert.deepEqual(afterListDelete.stats, { groups: 2, lists: 2, bookmarks: 2 })
    assert.equal(
      afterListDelete.groups.find((group) => group.id === newGroup.id).lists.length,
      1,
    )

    const groupB = afterListDelete.groups.find((group) => group.name === 'B')
    const afterGroupDelete = await store.mutate(
      { type: 'delete-group', groupId: groupB.id },
      afterListDelete.revision,
    )
    assert.deepEqual(afterGroupDelete.stats, { groups: 1, lists: 1, bookmarks: 2 })

    const disk = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(disk.groups.map((group) => group.name), ['A2'])
    assert.deepEqual(disk.groups[0].lists.map((list) => list.title), ['L2'])

    async function expectError(op, revision, status, code) {
      let error = null
      try {
        await store.mutate(op, revision)
      } catch (thrown) {
        error = thrown
      }
      assert.equal(error?.status, status)
      assert.equal(error?.code, code)
    }

    await expectError(
      { type: 'rename-group', groupId: newGroup.id, name: '   ' },
      afterGroupDelete.revision,
      400,
      'invalid-name',
    )
    await expectError(
      { type: 'rename-group', groupId: 'g_missing', name: 'X' },
      afterGroupDelete.revision,
      404,
      'unknown-group',
    )
    await expectError(
      { type: 'delete-list', groupId: groupB.id, listId: newGroup.lists[0].id },
      afterGroupDelete.revision,
      404,
      'unknown-list',
    )

    const empty = await store.mutate(
      { type: 'delete-group', groupId: newGroup.id },
      afterGroupDelete.revision,
    )
    assert.deepEqual(empty.stats, { groups: 0, lists: 0, bookmarks: 0 })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function testRenameRemap() {
  const {
    renameMaps,
    remapOrderForRename,
    remapExpandedForRename,
    remapSelectedForRename,
  } = requireFromSource('./remap.js')

  const groupRename = {
    kind: 'group',
    oldGroupId: 'g_old',
    groupId: 'g_new',
    lists: [{ from: 'l_old', to: 'l_new' }],
    bookmarks: [
      { from: 'b1_old', to: 'b1_new' },
      { from: 'b2_old', to: 'b2_new' },
    ],
  }
  assert.equal(renameMaps(groupRename).groups.get('g_old'), 'g_new')
  assert.deepEqual(
    remapOrderForRename(
      {
        groups: ['g_other', 'g_old'],
        lists: { g_old: ['l_old'] },
        bookmarks: { l_old: ['b2_old', 'b1_old'] },
      },
      groupRename,
    ),
    {
      groups: ['g_other', 'g_new'],
      lists: { g_new: ['l_new'] },
      bookmarks: { l_new: ['b2_new', 'b1_new'] },
    },
  )
  assert.deepEqual(remapExpandedForRename({ l_old: false }, groupRename), { l_new: false })
  assert.deepEqual(
    [...remapSelectedForRename(new Set(['b1_old', 'b_other']), groupRename)],
    ['b1_new', 'b_other'],
  )

  const listRename = {
    kind: 'list',
    groupId: 'g_same',
    oldListId: 'l_old',
    listId: 'l_new',
    lists: [{ from: 'l_old', to: 'l_new' }],
    bookmarks: [{ from: 'b_old', to: 'b_new' }],
  }
  assert.deepEqual(
    remapOrderForRename(
      { groups: ['g_same'], lists: { g_same: ['l_old'] }, bookmarks: { l_old: ['b_old'] } },
      listRename,
    ),
    { groups: ['g_same'], lists: { g_same: ['l_new'] }, bookmarks: { l_new: ['b_new'] } },
  )
}

/**
 * A tiny recursive renderer for the dialog components. It cannot paint or run
 * effects; it only executes the component tree with a React-shaped stub, which
 * is enough to catch missing props, undefined helpers, and bad branching.
 */
async function testDialogRender() {
  const originalLoad = Module._load
  const ReactStub = {
    createElement(type, props, ...children) {
      const next = { ...(props ?? {}) }
      if (children.length === 1) next.children = children[0]
      else if (children.length > 1) next.children = children
      return { type, props: next }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    useLayoutEffect() {},
    useMemo(factory) {
      return factory()
    },
    useCallback(callback) {
      return callback
    },
    useRef(value) {
      return { current: value }
    },
  }

  function render(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (Array.isArray(node)) {
      for (const child of node) render(child)
      return
    }
    if (typeof node === 'string' || typeof node === 'number') return
    const type = node.type
    if (typeof type === 'function') {
      render(type(node.props))
      return
    }
    if (typeof type === 'string') {
      render(node.props.children)
      return
    }
    throw new Error('unexpected element type: ' + String(type))
  }

  Module._load = function (request, parent, isMain) {
    if (request === 'react') return ReactStub
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const { BatchDeleteDialog, StructureDeleteDialog, RenameDialog } =
      requireFromSource('./dialogs.js')
    const t = (key) => key
    const noop = () => {}

    render(
      ReactStub.createElement(BatchDeleteDialog, {
        t,
        entries: [
          {
            group: { name: 'G' },
            list: { title: 'L' },
            bookmark: { id: 'b1', title: 'B' },
          },
        ],
        busy: false,
        error: '',
        onCancel: noop,
        onConfirm: noop,
      }),
    )

    render(
      ReactStub.createElement(StructureDeleteDialog, {
        t,
        scope: 'group',
        name: 'G',
        lists: 2,
        bookmarks: 3,
        rows: [{ path: '2 bookmarks', title: 'L' }],
        more: '',
        busy: false,
        error: '',
        onCancel: noop,
        onConfirm: noop,
      }),
    )

    render(
      ReactStub.createElement(StructureDeleteDialog, {
        t,
        scope: 'list',
        name: 'L',
        lists: 0,
        bookmarks: 0,
        rows: [],
        busy: false,
        error: '',
        onCancel: noop,
        onConfirm: noop,
      }),
    )

    render(
      ReactStub.createElement(RenameDialog, {
        t,
        scope: 'group',
        value: 'G',
        busy: false,
        error: '',
        onCancel: noop,
        onConfirm: noop,
        onDirty: noop,
      }),
    )
  } finally {
    Module._load = originalLoad
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
    pruneSelected,
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

  const kept = pruneSelected(new Set(['b1', 'gone']), { groups })
  assert.deepEqual([...kept], ['b1'])
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
await test('structure mutations', testStructureMutations)
await test('rename remap', testRenameRemap)
await test('dialog render', testDialogRender)
await test('client bundle', testClientBundle)
await test('styles', testStyles)
await test('rail sizing', testRailSizing)
await test('order helpers', testOrderHelpers)
await test('selection helpers', testSelectionHelpers)
await test('local storage', testStorage)
await test('routes', testRoutes)
console.log('smoke: all checks passed')
