/**
 * Archive (资料库) — browser bundle.
 *
 * GENERATED FILE. Edit the modules under `src/client/` and run
 * `npm run build:client`. DSH serves exactly one self-contained lazy-CJS
 * bundle per plugin, so the source modules are wrapped into this file.
 */
window.__ModuleLoader__.load({
  id: 'dsh-archive',
  factory(require) {
    var __modules = {
"./api.js": function (module, exports, require) {
/** The two Host calls the panel makes. Both fail by throwing. */
const { LIBRARY_URL, OPEN_URL } = require('./constants.js')

async function fetchLibrary(signal) {
  const response = await fetch(LIBRARY_URL, {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const payload = await response.json()
  if (!Array.isArray(payload?.groups) || payload.groups.length === 0) {
    throw new Error('empty-collection')
  }
  return payload
}

async function openBookmark(url) {
  const response = await fetch(OPEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
}

module.exports = { fetchLibrary, openBookmark }
      },
"./bookmarks.js": function (module, exports, require) {
/** Presentational pieces of the library: group rows, list sections, cards. */
const React = require('react')
const h = React.createElement
const { useState } = React
const { Chevron } = require('./glyphs.js')
const { Sortable } = require('./sortable.js')

/** The single letter a favicon-less bookmark shows in its 18px tile. */
function letterFor(bookmark) {
  try {
    const host = new URL(bookmark.url).hostname.replace(/^www\./i, '')
    if (host) return host.charAt(0).toUpperCase()
  } catch {
    // The Host filters malformed URLs, but the fallback keeps the card
    // rendered instead of throwing if that ever changes.
  }
  const title = typeof bookmark.title === 'string' ? bookmark.title.trim() : ''
  return title ? title.charAt(0).toUpperCase() : '?'
}

/**
 * A bookmark's favicon. Many exported icons are long dead, so a broken image
 * degrades to a letter tile instead of an empty box.
 */
function Favicon({ bookmark }) {
  const [failed, setFailed] = useState(false)
  const usable = typeof bookmark.icon === 'string' && bookmark.icon !== '' && !failed
  if (!usable) {
    return h(
      'span',
      { className: 'ar-fav ar-fav--letter', 'aria-hidden': 'true' },
      letterFor(bookmark),
    )
  }
  return h('img', {
    className: 'ar-fav',
    src: bookmark.icon,
    alt: '',
    width: 18,
    height: 18,
    loading: 'lazy',
    referrerPolicy: 'no-referrer',
    draggable: false,
    onError: () => setFailed(true),
  })
}

/**
 * One bookmark. It stays a real anchor so hover shows the destination and
 * the context menu can copy it; a plain left click is intercepted and sent
 * to the Host, which hands the URL to the system browser. Modified clicks
 * keep the browser's own new-tab behavior.
 */
function BookmarkCard({ bookmark, onOpen }) {
  return h(
    'a',
    {
      className: 'ar-card',
      href: bookmark.url,
      target: '_blank',
      rel: 'noreferrer',
      title: bookmark.title + '\n' + bookmark.url,
      draggable: false,
      'data-sort-id': bookmark.id,
      onClick: (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onOpen(bookmark.url)
      },
    },
    h(Favicon, { bookmark }),
    h('span', { className: 'ar-card__title' }, bookmark.title),
  )
}

/**
 * A second-level folder: its header toggles a grid of bookmark cards. The
 * colour comes from the surrounding view's `data-tone`, so every list of a
 * group shares that group's hue at a softer saturation.
 */
function ListSection({ list, open, collapsible, sortable, onToggle, onOpen, onReorderBookmarks }) {
  const inner = [
    h(Chevron, { key: 'chev', open }),
    h('span', { key: 'title', className: 'ar-sec__title' }, list.title),
    h('span', { key: 'count', className: 'ar-sec__count' }, list.count),
  ]
  const sortAttrs = { 'data-sort-id': list.id }
  const head = collapsible
    ? h(
        'button',
        {
          type: 'button',
          className: 'ar-sec__head',
          'aria-expanded': open ? 'true' : 'false',
          ...sortAttrs,
          onClick: onToggle,
        },
        inner,
      )
    : h('div', { className: 'ar-sec__head', 'data-static': 'true', ...sortAttrs }, inner)

  const bookmarkIds = list.bookmarks.map((bookmark) => bookmark.id)

  return h(
    'section',
    {
      className: 'ar-sec',
      'data-open': open ? 'true' : 'false',
      'aria-label': list.title,
    },
    head,
    h(
      'div',
      { className: 'ar-sec__body' },
      h(
        'div',
        { className: 'ar-sec__inner' },
        h(
          Sortable,
          {
            className: 'ar-grid',
            ids: bookmarkIds,
            axis: 'grid',
            disabled: !sortable || bookmarkIds.length < 2,
            onReorder: (from, to) => onReorderBookmarks(list.id, bookmarkIds, from, to),
          },
          list.bookmarks.map((bookmark) =>
            h(BookmarkCard, { key: bookmark.id, bookmark, onOpen }),
          ),
        ),
      ),
    ),
  )
}

function GroupRow({ group, tone, count, active, dim, onClick }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'ar-group',
      'data-tone': String(tone),
      'data-active': active ? 'true' : 'false',
      'data-dim': dim ? 'true' : 'false',
      'data-sort-id': group.id,
      'aria-current': active ? 'true' : undefined,
      title: group.name,
      onClick,
    },
    h('span', { className: 'ar-group__name' }, group.name),
    h('span', { className: 'ar-group__count' }, count),
  )
}

module.exports = { Favicon, BookmarkCard, ListSection, GroupRow }
      },
"./constants.js": function (module, exports, require) {
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
      },
"./glyphs.js": function (module, exports, require) {
/** Small inline SVGs shared by the sidebar row and the panel. */
const React = require('react')
const h = React.createElement

/** The archive-box glyph, shared by the sidebar row and the page header. */
function ArchiveGlyph({ size, strokeWidth }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: strokeWidth === undefined ? 1.7 : strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block' },
    },
    h('rect', { x: 3, y: 3.8, width: 18, height: 4.6, rx: 1.2 }),
    h('path', { d: 'M4.6 8.4v9.5c0 1 .8 1.8 1.8 1.8h11.2c1 0 1.8-.8 1.8-1.8V8.4' }),
    h('path', { d: 'M9.9 12.6h4.2' }),
  )
}

/** The list-section disclosure arrow. */
function Chevron({ open }) {
  return h(
    'span',
    { className: 'ar-sec__chev' },
    h(
      'svg',
      {
        width: 12,
        height: 12,
        viewBox: '0 0 12 12',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      h('path', { d: 'M4.5 2.5 8 6l-3.5 3.5' }),
    ),
  )
}

/** The page-header search glyph. */
function SearchGlyph() {
  return h(
    'svg',
    {
      width: 13,
      height: 13,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('circle', { cx: 7, cy: 7, r: 4.4 }),
    h('path', { d: 'm10.4 10.4 3 3' }),
  )
}

/** The sidebar row: a 20px glyph that thickens while its panel is open. */
function PanelIcon({ size, active }) {
  return h(ArchiveGlyph, { size, strokeWidth: active ? 1.9 : 1.7 })
}

module.exports = { ArchiveGlyph, Chevron, SearchGlyph, PanelIcon }
      },
"./header.js": function (module, exports, require) {
/** The page header: the plugin name and the live search field. */
const React = require('react')
const h = React.createElement
const { ArchiveGlyph, SearchGlyph } = require('./glyphs.js')

function PageHeader({ t, query, onQueryChange }) {
  return h(
    'header',
    { className: 'ar-header', key: 'header' },
    h(
      'div',
      { className: 'ar-brand' },
      h('span', { className: 'ar-brand__glyph' }, h(ArchiveGlyph, { size: 20 })),
      h('h1', { className: 'ar-brand__name' }, t('title')),
    ),
    h('span', { className: 'ar-header__spacer' }),
    h(
      'label',
      { className: 'ar-search' },
      h('span', { className: 'ar-search__glyph' }, h(SearchGlyph, null)),
      h('input', {
        className: 'ar-search__input',
        type: 'search',
        value: query,
        placeholder: t('search'),
        'aria-label': t('search'),
        spellCheck: false,
        onChange: (event) => onQueryChange(event.target.value),
      }),
    ),
  )
}

module.exports = { PageHeader }
      },
"./i18n.js": function (module, exports, require) {
/**
 * The two dictionaries registered under the plugin's own locale namespace.
 * `zh` is the key-set source of truth; `en` mirrors it.
 */
const zh = {
  title: '资料库',
  search: '搜索书签',
  groups: '分组',
  'count.groups': '{n} 个分组',
  'count.lists': '{n} 个列表',
  'count.bookmarks': '{n} 个书签',
  'count.match': '匹配 {n} 条',
  expandAll: '全部展开',
  collapseAll: '全部收起',
  'status.loading': '正在加载书签…',
  'status.empty': '这个分组下还没有书签',
  'status.noMatch': '没有匹配「{q}」的书签',
  'status.error': '书签加载失败',
  'status.errorHint': '请检查插件目录下的 data/bookmarks.json 是否存在且格式正确。',
  retry: '重试',
  'open.failed': '无法在系统浏览器中打开这个链接',
}

const en = {
  title: 'Archive',
  search: 'Search bookmarks',
  groups: 'Groups',
  'count.groups': '{n} groups',
  'count.lists': '{n} lists',
  'count.bookmarks': '{n} bookmarks',
  'count.match': '{n} matches',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  'status.loading': 'Loading bookmarks…',
  'status.empty': 'No bookmarks in this group yet',
  'status.noMatch': 'No bookmarks match “{q}”',
  'status.error': 'Could not load bookmarks',
  'status.errorHint': 'Check that data/bookmarks.json exists in the plugin directory and has the expected shape.',
  retry: 'Retry',
  'open.failed': 'Could not open this link in your browser',
}

module.exports = { zh, en }
      },
"./index.js": function (module, exports, require) {
/**
 * Client entry: registers the locale dictionaries, the `main` panel, and the
 * `sidebar.panellist` row. All rendering lives in `panel.js` and below, so
 * this file stays a small composition root.
 */
const React = require('react')
const h = React.createElement
const { NS, PANEL_ID } = require('./constants.js')
const { zh, en } = require('./i18n.js')
const { Panel } = require('./panel.js')
const { PanelIcon } = require('./glyphs.js')

function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-archive: dictionaries')

  const t = ctx.locale.bind(NS)
  const PanelEntry = (props) => h(Panel, { ...props, t: props.t || t })

  ctx.effect(
    () =>
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, PanelEntry),
      ),
    'dsh-archive: main panel',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 30,
            label: () => t('title'),
            locale: NS,
          },
          PanelIcon,
        ),
      ),
    'dsh-archive: sidebar entry',
  )
}

module.exports = { apply, inject: ['slots', 'locale'] }
      },
"./order.js": function (module, exports, require) {
/**
 * Pure helpers for the reader's manual order and search. Keeping them free of
 * React makes the state transitions in `panel.js` short and testable.
 */

/** The shape persisted under `dsh-archive:order:v2`. */
function emptyOrder() {
  return { groups: [], lists: {}, bookmarks: {} }
}

function stringIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
}

/**
 * Applies a remembered id order to one level. Ids that disappeared are
 * ignored, and items that are new since the order was saved keep their data
 * position at the end.
 */
function applyOrder(items, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item !== undefined) {
      ordered.push(item)
      byId.delete(id)
    }
  }
  if (ordered.length === items.length) return ordered
  for (const item of items) {
    if (byId.has(item.id)) ordered.push(item)
  }
  return ordered
}

/**
 * Moves one id to an insertion slot in the full order. Slots are counted
 * before the drag, so the dragged item itself still occupies its old slot.
 */
function moveId(ids, from, to) {
  if (from < 0 || from >= ids.length || to < 0 || to > ids.length) return ids
  const destination = to > from ? to - 1 : to
  if (destination === from) return ids
  const next = ids.slice()
  const [id] = next.splice(from, 1)
  next.splice(destination, 0, id)
  return next
}

function matchesQuery(bookmark, query) {
  return (
    bookmark.title.toLowerCase().includes(query) ||
    bookmark.url.toLowerCase().includes(query)
  )
}

/**
 * Stable fingerprint of the loaded library. A saved order that belongs to a
 * different file must not scramble this one; any change to names, titles, or
 * URLs produces a new signature, while icon-only changes keep the order.
 */
function collectionSignature(collection) {
  const parts = []
  for (const group of collection?.groups ?? []) {
    parts.push(group.id, group.name)
    for (const list of group.lists ?? []) {
      parts.push(list.id, list.title)
      for (const bookmark of list.bookmarks ?? []) {
        parts.push(bookmark.id, bookmark.title, bookmark.url)
      }
    }
  }
  const text = parts.join('\u0001')
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36) + ':' + text.length.toString(36)
}

/** Hits per group while searching, or null when the query is empty. */
function countGroupMatches(groups, query) {
  if (query === '') return null
  const counts = new Map()
  for (const group of groups) {
    let total = 0
    for (const list of group.lists) {
      for (const bookmark of list.bookmarks) {
        if (matchesQuery(bookmark, query)) total += 1
      }
    }
    counts.set(group.id, total)
  }
  return counts
}

/** Returns a copy of the list with its bookmarks in the reader's order. */
function orderListBookmarks(list, order) {
  return {
    ...list,
    bookmarks: applyOrder(list.bookmarks, order.bookmarks[list.id] ?? []),
  }
}

/** Returns the matching subset of a list, or null when nothing matches. */
function filterListBookmarks(list, order, query) {
  const bookmarks = applyOrder(list.bookmarks, order.bookmarks[list.id] ?? []).filter(
    (bookmark) => matchesQuery(bookmark, query),
  )
  if (bookmarks.length === 0) return null
  return { ...list, bookmarks, count: bookmarks.length }
}

module.exports = {
  emptyOrder,
  stringIds,
  applyOrder,
  moveId,
  matchesQuery,
  collectionSignature,
  countGroupMatches,
  orderListBookmarks,
  filterListBookmarks,
}
      },
"./panel.js": function (module, exports, require) {
/**
 * The Archive page: state ownership plus the two-column layout. Data loading,
 * local persistence, ordering, search, and the header/side sections each live
 * in a small module; this file wires them together.
 */
const React = require('react')
const {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
} = React
const h = React.createElement

const { CSS } = require('./styles.js')
const { PageHeader } = require('./header.js')
const { GroupRail } = require('./sidebar.js')
const { ListSection } = require('./bookmarks.js')
const { Sortable } = require('./sortable.js')
const { TONE_COUNT } = require('./constants.js')
const { fetchLibrary, openBookmark: requestOpen } = require('./api.js')
const {
  readSavedState,
  writeSavedState,
  readSavedOrder,
  writeSavedOrder,
} = require('./storage.js')
const {
  emptyOrder,
  applyOrder,
  moveId,
  collectionSignature,
  countGroupMatches,
  orderListBookmarks,
  filterListBookmarks,
} = require('./order.js')

/**
 * @param props - the slot's locale-injected `t` seat.
 * @returns the full two-column library, or a loading/error placeholder.
 */
function Panel(props) {
  const t = props.t
  const [status, setStatus] = useState('loading')
  const [collection, setCollection] = useState(null)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [order, setOrder] = useState(emptyOrder)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const mainRef = useRef(null)
  const mountedRef = useRef(true)

  const orderSignature = useMemo(
    () => (collection === null ? '' : collectionSignature(collection)),
    [collection],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setStatus('loading')

    const run = async () => {
      try {
        const payload = await fetchLibrary(controller.signal)
        if (!live) return

        const groups = payload.groups
        const saved = readSavedState()
        const preferred =
          (saved.groupId && groups.some((group) => group.id === saved.groupId)
            ? saved.groupId
            : null) ?? groups[0].id
        const signature = collectionSignature(payload)
        const savedOrder = readSavedOrder()

        setCollection(payload)
        setOrder(
          savedOrder !== null && savedOrder.signature === signature
            ? {
                groups: savedOrder.groups,
                lists: savedOrder.lists,
                bookmarks: savedOrder.bookmarks,
              }
            : emptyOrder(),
        )
        setActiveGroupId(preferred)
        setExpanded(saved.expanded)
        setStatus('ready')
      } catch (error) {
        if (!live || error?.name === 'AbortError') return
        setStatus('error')
      }
    }

    void run()
    return () => {
      live = false
      controller.abort()
    }
  }, [attempt])

  useEffect(() => {
    if (status !== 'ready') return
    writeSavedState({ groupId: activeGroupId, expanded })
  }, [status, activeGroupId, expanded])

  useEffect(() => {
    if (status !== 'ready' || orderSignature === '') return
    writeSavedOrder(order, orderSignature)
  }, [status, order, orderSignature])

  useEffect(() => {
    if (toast === null) return undefined
    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  /* Reset before paint, so a group switch never flashes the old scroll offset. */
  useLayoutEffect(() => {
    if (mainRef.current !== null) mainRef.current.scrollTop = 0
  }, [activeGroupId])

  const sourceGroups = useMemo(() => collection?.groups ?? [], [collection])
  const groups = useMemo(
    () => applyOrder(sourceGroups, order.groups),
    [sourceGroups, order.groups],
  )
  const groupIds = useMemo(() => groups.map((group) => group.id), [groups])
  const listsByGroup = useMemo(() => {
    const map = new Map()
    for (const group of sourceGroups) {
      map.set(group.id, applyOrder(group.lists, order.lists[group.id] ?? []))
    }
    return map
  }, [sourceGroups, order.lists])

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null
  const activeLists = activeGroup === null ? [] : listsByGroup.get(activeGroup.id) ?? []
  const queryText = query.trim().toLowerCase()

  const visibleLists = useMemo(() => {
    if (activeGroup === null) return []
    const lists = listsByGroup.get(activeGroup.id) ?? []
    if (queryText === '') {
      return lists.map((list) => orderListBookmarks(list, order))
    }
    const filtered = []
    for (const list of lists) {
      const matched = filterListBookmarks(list, order, queryText)
      if (matched !== null) filtered.push(matched)
    }
    return filtered
  }, [activeGroup, listsByGroup, order, queryText])
  const visibleListIds = useMemo(
    () => visibleLists.map((list) => list.id),
    [visibleLists],
  )
  const groupMatches = useMemo(
    () => countGroupMatches(groups, queryText),
    [groups, queryText],
  )

  const openBookmark = useCallback(
    (url) => {
      void (async () => {
        try {
          await requestOpen(url)
        } catch {
          if (mountedRef.current) setToast(t('open.failed'))
        }
      })()
    },
    [t],
  )

  const toggleList = useCallback((listId) => {
    setExpanded((current) => {
      const open = current[listId] !== false
      return { ...current, [listId]: !open }
    })
  }, [])

  const expandAll = useCallback(() => setExpanded({}), [])
  const collapseAll = useCallback(() => {
    const next = {}
    for (const list of activeLists) next[list.id] = false
    setExpanded(next)
  }, [activeLists])

  /** The one header button collapses only when every list is already open. */
  const allListsOpen =
    activeGroup !== null && activeLists.every((list) => expanded[list.id] !== false)

  const reorderGroups = useCallback(
    (from, to) => {
      setOrder((current) => {
        const next = moveId(groupIds, from, to)
        return next === groupIds ? current : { ...current, groups: next }
      })
    },
    [groupIds],
  )

  const reorderLists = useCallback(
    (from, to) => {
      if (activeGroup === null) return
      setOrder((current) => {
        const next = moveId(visibleListIds, from, to)
        const key = activeGroup.id
        return next === visibleListIds
          ? current
          : { ...current, lists: { ...current.lists, [key]: next } }
      })
    },
    [activeGroup, visibleListIds],
  )

  const reorderBookmarks = useCallback((listId, ids, from, to) => {
    setOrder((current) => {
      const next = moveId(ids, from, to)
      return next === ids
        ? current
        : { ...current, bookmarks: { ...current.bookmarks, [listId]: next } }
    })
  }, [])

  const stats = collection?.stats ?? { groups: 0, lists: 0, bookmarks: 0 }
  const header = h(PageHeader, { t, query, onQueryChange: setQuery })

  /**
   * Which way the right column should slide when the group changes: the new
   * group sits below the previous one, so its content enters from below (or
   * from above when moving up the rail).
   */
  const lastGroupIndexRef = useRef(-1)
  const groupIndex =
    activeGroup === null ? -1 : groups.findIndex((group) => group.id === activeGroup.id)
  const switchDir =
    groupIndex !== -1 &&
    lastGroupIndexRef.current !== -1 &&
    groupIndex < lastGroupIndexRef.current
      ? 'up'
      : 'down'
  /* The right column carries the active group's hue, so its title matches that rail row. */
  const activeGroupTone = groupIndex < 0 ? 0 : groupIndex % TONE_COUNT
  useEffect(() => {
    lastGroupIndexRef.current = groupIndex
  }, [groupIndex])

  if (status === 'loading') {
    return h(
      'div',
      { className: 'ar-root' },
      h('style', { key: 'styles' }, CSS),
      header,
      h('div', { className: 'ar-state' }, t('status.loading')),
    )
  }

  if (status === 'error') {
    return h(
      'div',
      { className: 'ar-root' },
      h('style', { key: 'styles' }, CSS),
      header,
      h(
        'div',
        { className: 'ar-state' },
        h('div', { className: 'ar-state__title' }, t('status.error')),
        h('div', { className: 'ar-state__hint' }, t('status.errorHint')),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn',
            style: { borderColor: 'var(--dsw-alias-border-l2)' },
            onClick: () => setAttempt((value) => value + 1),
          },
          t('retry'),
        ),
      ),
    )
  }

  const side = h(GroupRail, {
    t,
    stats,
    groups,
    groupIds,
    groupMatches,
    activeGroupId: activeGroup === null ? null : activeGroup.id,
    onSelect: setActiveGroupId,
    onReorder: reorderGroups,
  })

  const mainChildren = []

  if (activeGroup !== null) {
    mainChildren.push(
      h(
        'div',
        { className: 'ar-main__head', key: 'head' },
        h(
          'div',
          { className: 'ar-main__titles' },
          h('h2', { className: 'ar-main__title', title: activeGroup.name }, activeGroup.name),
          h(
            'div',
            { className: 'ar-main__meta' },
            queryText === ''
              ? [
                  t('count.lists', { n: activeLists.length }),
                  t('count.bookmarks', { n: activeGroup.count }),
                ].join(' · ')
              : t('count.match', {
                  n: visibleLists.reduce((total, list) => total + list.count, 0),
                }),
          ),
        ),
        queryText === ''
          ? h(
              'div',
              { className: 'ar-main__actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ar-btn',
                  onClick: allListsOpen ? collapseAll : expandAll,
                },
                allListsOpen ? t('collapseAll') : t('expandAll'),
              ),
            )
          : null,
      ),
    )

    if (visibleLists.length === 0) {
      mainChildren.push(
        h(
          'div',
          { className: 'ar-state', key: 'empty' },
          h(
            'div',
            { className: 'ar-state__title' },
            queryText === '' ? t('status.empty') : t('status.noMatch', { q: query.trim() }),
          ),
        ),
      )
    } else {
      mainChildren.push(
        h(
          Sortable,
          {
            className: 'ar-sections',
            key: 'sections',
            ids: visibleListIds,
            axis: 'y',
            disabled: queryText !== '' || visibleListIds.length < 2,
            onReorder: reorderLists,
          },
          visibleLists.map((list) => {
            const open = queryText === '' ? expanded[list.id] !== false : true
            return h(ListSection, {
              key: list.id,
              list,
              open,
              collapsible: queryText === '',
              sortable: queryText === '',
              onToggle: () => toggleList(list.id),
              onOpen: openBookmark,
              onReorderBookmarks: reorderBookmarks,
            })
          }),
        ),
      )
    }
  }

  const main = h(
    'div',
    { className: 'ar-main', key: 'main', ref: mainRef },
    h(
      'div',
      {
        className: 'ar-view',
        key: activeGroup === null ? 'empty' : activeGroup.id,
        'data-dir': switchDir,
        'data-tone': String(activeGroupTone),
      },
      mainChildren,
    ),
  )

  return h(
    'div',
    { className: 'ar-root' },
    h('style', { key: 'styles' }, CSS),
    header,
    h('div', { className: 'ar-body' }, side, main),
    toast === null ? null : h('div', { className: 'ar-toast', role: 'status' }, toast),
  )
}

module.exports = { Panel }
      },
"./sidebar.js": function (module, exports, require) {
/** The narrow left rail: group selection, drag order, and global stats. */
const React = require('react')
const h = React.createElement
const { GroupRow } = require('./bookmarks.js')
const { Sortable } = require('./sortable.js')
const { TONE_COUNT } = require('./constants.js')

function GroupRail({ t, stats, groups, groupIds, groupMatches, activeGroupId, onSelect, onReorder }) {
  return h(
    'aside',
    { className: 'ar-side', key: 'side' },
    h('div', { className: 'ar-side__head' }, h('span', null, t('groups'))),
    h(
      Sortable,
      {
        className: 'ar-side__list',
        ids: groupIds,
        axis: 'y',
        disabled: groupIds.length < 2,
        onReorder,
        'aria-label': t('groups'),
      },
      groups.map((group, index) =>
        h(GroupRow, {
          key: group.id,
          group,
          tone: index % TONE_COUNT,
          count: groupMatches === null ? group.count : groupMatches.get(group.id) ?? 0,
          active: group.id === activeGroupId,
          dim: groupMatches !== null && (groupMatches.get(group.id) ?? 0) === 0,
          onClick: () => onSelect(group.id),
        }),
      ),
    ),
    h(
      'div',
      { className: 'ar-side__foot' },
      h('span', null, t('count.groups', { n: stats.groups })),
      h('span', null, t('count.lists', { n: stats.lists })),
      h('span', null, t('count.bookmarks', { n: stats.bookmarks })),
    ),
  )
}

module.exports = { GroupRail }
      },
"./sortable.js": function (module, exports, require) {
/**
 * Drag sorting for one parent element. Rendering is delegated to the parent;
 * this component only owns the pointer gesture, the floating ghost, the
 * dashed source placeholder, the insertion preview, and the FLIP transitions
 * that move the neighbours.
 */
const React = require('react')
const { useRef, useEffect, useCallback } = React
const h = React.createElement
const { HOLD_MS, DRAG_TRIGGER_DISTANCE, TOUCH_SCROLL_TOLERANCE } = require('./constants.js')

/**
 * Drag sorting for one parent element.
 *
 * A drag leaves a blank outline in the source slot and inserts a
 * semi-transparent preview in the target slot, so the list itself shows
 * where the element will land. The preview is a real element in the flow:
 * its neighbours are pushed aside, and every push is animated with a FLIP
 * transition. Quick clicks never start a drag.
 */
function Sortable({ ids, axis, disabled, className, onReorder, children, ...rest }) {
  const rootRef = useRef(null);
  const apiRef = useRef(null);
  const suppressClickRef = useRef(false);
  const propsRef = useRef({});
  propsRef.current = {
    ids,
    axis: axis === 'grid' ? 'grid' : 'y',
    disabled: disabled === true,
    onReorder,
  };

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;

    let holdTimer = 0;
    let settleFrame = 0;
    let scrollFrame = 0;
    let finalFrame = 0;
    let suppressTimer = 0;
    let pending = null;
    let active = null;
    let scrollEl = null;
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const panel = () => root.closest('.ar-root');

    const items = () =>
      Array.from(root.querySelectorAll('[data-sort-id]')).filter(
        (element) => element.closest('[data-sort-scope]') === root,
      );

    /** A clone must never be sortable, focusable, or exposed to the reader. */
    const cloneForDrag = (source, mode) => {
      const clone = source.cloneNode(true);
      clone.removeAttribute('data-sort-id');
      clone.style.display = '';
      clone.removeAttribute('aria-expanded');
      clone.removeAttribute('aria-current');
      clone.setAttribute('data-sort-' + mode, 'true');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      clone.querySelectorAll('[data-sort-id]').forEach((element) => {
        element.removeAttribute('data-sort-id');
      });
      clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
        element.setAttribute('tabindex', '-1');
        if (element.tagName === 'A') element.setAttribute('draggable', 'false');
      });
      return clone;
    };

    /* Real sort units, never the translucent preview or the floating ghost. */
    const realItems = () => {
      if (active === null) return [];
      if (active.kind === 'list') {
        return Array.from(root.children).filter(
          (child) =>
            child.classList.contains('ar-sec') &&
            child.getAttribute('data-sort-preview') !== 'true' &&
            child.getAttribute('data-sort-placeholder') !== 'true',
        );
      }
      return items();
    };

    /* Elements whose boxes should glide when the source leaves or the
       preview changes slot. The source itself is out of the flow. */
    const participants = () => {
      if (active === null) return [];
      const nodes = realItems().filter((node) => node !== active.block);
      if (
        active.preview !== null &&
        active.preview.parentNode === root &&
        !nodes.includes(active.preview)
      ) {
        nodes.push(active.preview);
      }
      return nodes;
    };

    const measure = (nodes) => {
      const rects = new Map();
      for (const node of nodes) {
        if (!node.isConnected) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        rects.set(node, rect);
      }
      return rects;
    };

    const cancelFlips = (nodes) => {
      for (const node of nodes) {
        if (typeof node.getAnimations !== 'function') continue;
        for (const animation of node.getAnimations()) {
          if (typeof animation.id === 'string' && animation.id.indexOf('ar-sort-') === 0) {
            animation.cancel();
          }
        }
      }
    };

    /**
     * FLIP: the new layout is already in place, so animate each moved item
     * from its previous visual box back to zero. Reading the visual box
     * before cancelling old animations also makes interrupted pushes glide
     * instead of snapping.
     */
    const playFlip = (before) => {
      if (reducedMotion || before.size === 0) return;
      for (const [node, oldRect] of before) {
        if (!node.isConnected || typeof node.animate !== 'function') continue;
        const newRect = node.getBoundingClientRect();
        if (newRect.width === 0 && newRect.height === 0) continue;
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        const animation = node.animate(
          [
            { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
            { transform: 'translate(0,0)' },
          ],
          { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' },
        );
        animation.id = 'ar-sort-flip';
      }
    };

    const previewElement = () => {
      if (active === null) return null;
      return cloneForDrag(active.block, 'preview');
    };

    const placePreview = (reference) => {
      if (active === null) return;
      const drag = active;
      if (
        drag.preview !== null &&
        drag.preview.parentNode === root &&
        drag.preview.nextElementSibling === reference
      ) {
        return;
      }
      const nodes = participants();
      const before = measure(nodes);
      cancelFlips(nodes);
      if (drag.preview === null) {
        drag.preview = previewElement();
        if (drag.preview === null) return;
        root.insertBefore(drag.preview, reference);
        if (!reducedMotion && typeof drag.preview.animate === 'function') {
          const fade = drag.preview.animate(
            [{ opacity: 0 }, { opacity: 0.55 }],
            { duration: 140, easing: 'ease-out' },
          );
          fade.id = 'ar-sort-fade';
        }
      } else {
        root.insertBefore(drag.preview, reference);
      }
      playFlip(before);
    };

    const clearPreview = () => {
      if (active === null || active.preview === null) return;
      const nodes = participants();
      const before = measure(nodes);
      cancelFlips(nodes);
      active.preview.remove();
      active.preview = null;
      playFlip(before);
    };

    const findScroller = () => {
      let node = root;
      while (node !== null && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const update = () => {
      if (active === null) return;
      const drag = active;
      if (drag.ghost !== null) {
        drag.ghost.style.left = drag.x - drag.grabX + 'px';
        drag.ghost.style.top = drag.y - drag.grabY + 'px';
      }
      let fillBefore = null;
      if (!drag.sourceLeft) {
        const placeholder = drag.placeholder;
        if (placeholder !== null) {
          const rect = placeholder.getBoundingClientRect();
          const inside =
            drag.x >= rect.left &&
            drag.x <= rect.right &&
            drag.y >= rect.top &&
            drag.y <= rect.bottom;
          if (inside) {
            drag.dropIndex = drag.fromIndex;
            clearPreview();
            return;
          }
        }
        fillBefore = measure(realItems().filter((node) => node !== drag.block));
        if (placeholder !== null) placeholder.remove();
        drag.placeholder = null;
        drag.sourceLeft = true;
      }
      const candidates =
        drag.kind === 'list'
          ? realItems().filter((element) => element !== drag.section)
          : items().filter((element) => element !== drag.item);
      let slotInOthers = candidates.length;
      if (drag.kind === 'list' || drag.axis === 'y') {
        for (let index = 0; index < candidates.length; index += 1) {
          const element =
            drag.kind === 'list'
              ? candidates[index].querySelector('.ar-sec__head') ?? candidates[index]
              : candidates[index];
          const box = element.getBoundingClientRect();
          if (drag.y < box.top + box.height / 2) {
            slotInOthers = index;
            break;
          }
        }
      } else {
        /* Cards form a grid: locate the row under the pointer first,
           then the column inside that row. The preview is excluded from
           the candidates, so its own box never becomes the target. */
        let rowStart = 0;
        while (rowStart < candidates.length) {
          const first = candidates[rowStart].getBoundingClientRect();
          const row = [first];
          let next = rowStart + 1;
          while (next < candidates.length) {
            const box = candidates[next].getBoundingClientRect();
            if (Math.abs(box.top - first.top) > 1) break;
            row.push(box);
            next += 1;
          }
          const rowBottom = row.reduce(
            (bottom, box) => Math.max(bottom, box.bottom),
            first.bottom,
          );
          if (drag.y < first.top) {
            slotInOthers = rowStart;
            break;
          }
          if (drag.y <= rowBottom) {
            let placed = rowStart + row.length;
            for (let column = 0; column < row.length; column += 1) {
              const box = row[column];
              if (drag.x < box.left + box.width / 2) {
                placed = rowStart + column;
                break;
              }
            }
            slotInOthers = placed;
            break;
          }
          rowStart = next;
        }
      }

      const slot =
        slotInOthers <= drag.fromIndex ? slotInOthers : slotInOthers + 1;
      drag.dropIndex = slot;
      if (fillBefore !== null) playFlip(fillBefore);
      /* Also preview the original slot: after the cursor has left the
         source placeholder and comes back, the insertion target must be
         visible just like any other slot. */
      placePreview(
        slotInOthers < candidates.length ? candidates[slotInOthers] : null,
      );
    };

    const scheduleUpdate = () => {
      if (settleFrame !== 0) return;
      settleFrame = window.requestAnimationFrame(() => {
        settleFrame = 0;
        update();
      });
    };

    const scrollTick = () => {
      scrollFrame = 0;
      if (active === null) return;
      if (scrollEl !== null) {
        const box = scrollEl.getBoundingClientRect();
        const edge = Math.min(48, Math.max(18, box.height / 3));
        let delta = 0;
        if (active.y < box.top + edge) {
          delta = -Math.min(18, Math.ceil((box.top + edge - active.y) / 4));
        } else if (active.y > box.bottom - edge) {
          delta = Math.min(18, Math.ceil((active.y - (box.bottom - edge)) / 4));
        }
        /* Cards can only move inside their own list, so never scroll the
           whole column past a list that is already fully on screen. */
        if (delta !== 0 && active.axis === 'grid') {
          const grid = root.getBoundingClientRect();
          if (delta > 0 && grid.bottom <= box.bottom + 1) delta = 0;
          else if (delta < 0 && grid.top >= box.top - 1) delta = 0;
        }
        if (delta !== 0) {
          const before = scrollEl.scrollTop;
          scrollEl.scrollTop = before + delta;
          if (scrollEl.scrollTop !== before) update();
        }
      }
      scrollFrame = window.requestAnimationFrame(scrollTick);
    };

    const finish = (cancelled) => {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
      pending = null;
      if (active === null) return;
      const drag = active;
      const sourceNode = drag.block;
      const finalNodes = realItems();
      const finalBefore = measure(finalNodes.filter((node) => node !== sourceNode));
      const hadPreview = drag.preview !== null;
      const anchor = cancelled
        ? (drag.ghost ?? drag.preview)
        : (drag.preview ?? drag.ghost);
      if (anchor !== null && sourceNode !== null) {
        finalBefore.set(sourceNode, anchor.getBoundingClientRect());
      }
      cancelFlips(finalNodes);
      cancelFlips(participants());
      window.cancelAnimationFrame(settleFrame);
      settleFrame = 0;
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      if (drag.preview !== null) {
        drag.preview.remove();
        drag.preview = null;
      }
      if (drag.ghost !== null) {
        drag.ghost.remove();
        drag.ghost = null;
      }
      if (drag.placeholder !== null) {
        drag.placeholder.remove();
        drag.placeholder = null;
      }
      sourceNode.style.display = drag.originalDisplay;
      if (
        !cancelled &&
        hadPreview &&
        !reducedMotion &&
        typeof sourceNode.animate === 'function'
      ) {
        /* The preview fades into the real element instead of popping. */
        const settle = sourceNode.animate(
          [{ opacity: 0.55 }, { opacity: 1 }],
          { duration: 140, easing: 'ease-out' },
        );
        settle.id = 'ar-sort-settle';
      }
      active = null;
      const rootPanel = panel();
      if (rootPanel !== null) rootPanel.removeAttribute('data-sorting');
      if (
        !cancelled &&
        drag.dropIndex !== drag.fromIndex &&
        drag.dropIndex !== drag.fromIndex + 1
      ) {
        const reorder = propsRef.current.onReorder;
        if (typeof reorder === 'function') reorder(drag.fromIndex, drag.dropIndex);
      }
      if (finalBefore.size > 0 && !reducedMotion) {
        window.cancelAnimationFrame(finalFrame);
        finalFrame = window.requestAnimationFrame(() => {
          finalFrame = 0;
          playFlip(finalBefore);
        });
      }
      /* A click follows pointerup; keep it from toggling a list or opening
         the card that was just dragged. */
      suppressClickRef.current = true;
      window.clearTimeout(suppressTimer);
      /* Touch can deliver its synthetic click noticeably later; a mouse
         click follows pointerup immediately, so a long block would also
         swallow an intentional follow-up click. */
      const clickDelay = drag.pointerType === 'touch' ? 450 : 80;
      suppressTimer = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressTimer = 0;
      }, clickDelay);
    };

    const activate = () => {
      holdTimer = 0;
      if (pending === null || active !== null) return;
      const start = pending;
      pending = null;
      if (propsRef.current.disabled) return;
      const section = start.item.closest('.ar-sec');
      const kind = start.item.classList.contains('ar-card')
        ? 'card'
        : start.item.classList.contains('ar-sec__head')
          ? 'list'
          : 'group';
      const block = kind === 'list' ? section : start.item;
      if (block === null) return;
      const rect = block.getBoundingClientRect();
      const originalDisplay = block.style.display;
      window.cancelAnimationFrame(finalFrame);
      finalFrame = 0;
      active = {
        pointerId: start.pointerId,
        pointerType: start.pointerType,
        item: start.item,
        block,
        fromIndex: start.index,
        axis: propsRef.current.axis,
        kind,
        section,
        originalDisplay,
        ghost: null,
        preview: null,
        placeholder: null,
        sourceLeft: false,
        x: start.startX,
        y: start.startY,
        grabX: start.startX - rect.left,
        grabY: start.startY - rect.top,
        dropIndex: start.index,
      };
      cancelFlips(realItems());
      active.ghost = cloneForDrag(block, 'ghost');
      if (!active.ghost.hasAttribute('data-tone')) {
        const toneHost = block.closest('[data-tone]');
        if (toneHost !== null) {
          active.ghost.setAttribute('data-tone', toneHost.getAttribute('data-tone'));
        }
      }
      active.ghost.style.width = rect.width + 'px';
      active.ghost.style.height = rect.height + 'px';
      active.ghost.style.left = start.startX - active.grabX + 'px';
      active.ghost.style.top = start.startY - active.grabY + 'px';
      const host = panel() ?? document.body;
      host.appendChild(active.ghost);
      if (block.parentNode !== null) {
        active.placeholder = cloneForDrag(block, 'placeholder');
        block.parentNode.insertBefore(active.placeholder, block);
      }
      block.style.display = 'none';
      scrollEl = findScroller();
      const rootPanel = panel();
      if (rootPanel !== null) rootPanel.setAttribute('data-sorting', 'true');
      const selection = window.getSelection();
      if (selection !== null) selection.removeAllRanges();
      update();
      scrollFrame = window.requestAnimationFrame(scrollTick);
    };

    const begin = (event) => {
      if (event.button !== 0 || active !== null) return;
      if (event.pointerType === 'mouse' && event.buttons !== 1) return;
      const props = propsRef.current;
      if (props.disabled || props.ids.length < 2) return;
      const target = event.target;
      const item = target instanceof Element ? target.closest('[data-sort-id]') : null;
      if (item === null || item.closest('[data-sort-scope]') !== root) return;
      const sortId = item.getAttribute('data-sort-id');
      const index = sortId === null ? -1 : props.ids.indexOf(sortId);
      if (index === -1) return;
      window.clearTimeout(holdTimer);
      pending = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        item,
        index,
      };
      /* A mouse/pen drag starts on movement, not on a hold; touch waits
         briefly so a vertical swipe can still scroll the rail. */
      if (event.pointerType === 'touch') {
        holdTimer = window.setTimeout(activate, HOLD_MS);
      }
    };

    const onPointerMove = (event) => {
      if (pending !== null && event.pointerId === pending.pointerId) {
        const dx = event.clientX - pending.startX;
        const dy = event.clientY - pending.startY;
        const distance = dx * dx + dy * dy;
        if (pending.pointerType === 'touch') {
          if (distance > TOUCH_SCROLL_TOLERANCE * TOUCH_SCROLL_TOLERANCE) {
            window.clearTimeout(holdTimer);
            holdTimer = 0;
            pending = null;
          }
          return;
        }
        if (distance > DRAG_TRIGGER_DISTANCE * DRAG_TRIGGER_DISTANCE) {
          window.clearTimeout(holdTimer);
          holdTimer = 0;
          activate();
          if (active !== null) {
            active.x = event.clientX;
            active.y = event.clientY;
            if (event.cancelable) event.preventDefault();
            scheduleUpdate();
          }
        }
        return;
      }
      if (active === null || event.pointerId !== active.pointerId) return;
      active.x = event.clientX;
      active.y = event.clientY;
      if (event.cancelable) event.preventDefault();
      scheduleUpdate();
    };

    const onPointerUp = (event) => {
      if (pending !== null && event.pointerId === pending.pointerId) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
        pending = null;
        return;
      }
      if (active !== null && event.pointerId === active.pointerId) finish(false);
    };

    const onPointerCancel = (event) => {
      if (pending !== null && event.pointerId === pending.pointerId) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
        pending = null;
        return;
      }
      if (active !== null && event.pointerId === active.pointerId) finish(true);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || (pending === null && active === null)) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
      pending = null;
      finish(true);
    };

    const onContextMenu = (event) => {
      if (pending !== null || active !== null) event.preventDefault();
    };

    apiRef.current = { begin };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
    root.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(suppressTimer);
      window.cancelAnimationFrame(settleFrame);
      window.cancelAnimationFrame(scrollFrame);
      window.cancelAnimationFrame(finalFrame);
      if (active !== null) {
        cancelFlips(realItems());
        if (active.preview !== null) active.preview.remove();
        if (active.ghost !== null) active.ghost.remove();
        if (active.placeholder !== null) active.placeholder.remove();
        active.block.style.display = active.originalDisplay;
        const rootPanel = panel();
        if (rootPanel !== null) rootPanel.removeAttribute('data-sorting');
        active = null;
      }
      pending = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('contextmenu', onContextMenu);
      apiRef.current = null;
      suppressClickRef.current = false;
    };
  }, []);

  const onPointerDown = useCallback((event) => {
    if (apiRef.current !== null) apiRef.current.begin(event);
  }, []);

  return h(
    'div',
    {
      ...rest,
      ref: rootRef,
      className,
      'data-sort-scope': '1',
      onPointerDown,
      onClickCapture: (event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
      onDragStart: (event) => event.preventDefault(),
    },
    children,
  );
}

module.exports = { Sortable }
      },
"./storage.js": function (module, exports, require) {
/**
 * The reader's local state: which group is selected, which lists are folded,
 * and the manual sort order. Both records are best-effort: storage may be
 * unavailable (private mode, full quota), which only costs that memory.
 */
const { ORDER_KEY, STATE_KEY } = require('./constants.js')
const { stringIds } = require('./order.js')

function readSavedState() {
  try {
    const raw = window.localStorage.getItem(STATE_KEY)
    if (raw === null) return { groupId: null, expanded: {} }
    const parsed = JSON.parse(raw)
    const expanded =
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof parsed.expanded === 'object' &&
      parsed.expanded !== null
        ? parsed.expanded
        : {}
    return {
      groupId: typeof parsed?.groupId === 'string' ? parsed.groupId : null,
      expanded,
    }
  } catch {
    return { groupId: null, expanded: {} }
  }
}

function writeSavedState(state) {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // A full quota or a private-mode window only costs the last selection,
    // which is not worth failing the page over.
  }
}

function readIdMap(value) {
  const map = {}
  if (value === null || typeof value !== 'object') return map
  for (const [key, ids] of Object.entries(value)) {
    if (key !== '__proto__') map[key] = stringIds(ids)
  }
  return map
}

function readSavedOrder() {
  try {
    const raw = window.localStorage.getItem(ORDER_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return null
    return {
      signature: typeof parsed.signature === 'string' ? parsed.signature : '',
      groups: stringIds(parsed.groups),
      lists: readIdMap(parsed.lists),
      bookmarks: readIdMap(parsed.bookmarks),
    }
  } catch {
    return null
  }
}

function writeSavedOrder(order, signature) {
  try {
    window.localStorage.setItem(
      ORDER_KEY,
      JSON.stringify({
        signature,
        groups: order.groups,
        lists: order.lists,
        bookmarks: order.bookmarks,
      }),
    )
  } catch {
    // Sorting still works for this session if storage is unavailable.
  }
}

module.exports = {
  readSavedState,
  writeSavedState,
  readSavedOrder,
  writeSavedOrder,
}
      },
"./styles.js": function (module, exports, require) {
/**
 * The panel stylesheet. Only `--dsw-alias-*` theme tokens are used for
 * surfaces, text, and borders, so light and dark themes stay consistent.
 * Dividers derive their weight from the theme tokens as well; one soft shadow
 * is the only literal colour, matching the other plugin panels.
 */
const CSS = `.ar-root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding-top:var(--dsh-frame-top-clearance,0px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;--ar-line:var(--dsw-alias-border-l1);--ar-line-strong:var(--dsw-alias-border-l2);--ar-card-lift:3%;--ar-card-lift-hover:6%}
/* Light surfaces read darker than dark ones at the same mix step, so the light theme lifts much less. The host flags dark mode on <body>. */
body[data-ds-dark-theme] .ar-root{--ar-card-lift:8%;--ar-card-lift-hover:14%}
.ar-root *,.ar-root *::before,.ar-root *::after{box-sizing:border-box}
/* Page header: the plugin name is the page's first-level title. */
.ar-header{flex:none;display:flex;align-items:center;gap:12px;height:50px;padding:0 16px;border-bottom:1px solid var(--ar-line-strong)}
.ar-brand{flex:initial;display:flex;align-items:center;gap:9px;min-width:0}
.ar-brand__glyph{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-brand-primary)}
.ar-brand__name{flex:none;margin:0;font-size:18px;line-height:24px;font-weight:600;letter-spacing:.005em;white-space:nowrap}
.ar-header__spacer{flex:1;min-width:8px}
.ar-search{position:relative;flex:none;display:flex;align-items:center;width:210px;height:28px;border:1px solid var(--ar-line);border-radius:7px;background:var(--dsw-alias-bg-layer-1);transition:border-color .16s ease}
.ar-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.ar-search__glyph{position:absolute;left:7px;display:inline-flex;color:var(--dsw-alias-label-secondary);pointer-events:none}
.ar-search__input{width:100%;height:100%;padding:0 8px 0 26px;border:0;border-radius:inherit;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
.ar-search__input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.ar-body{display:flex;flex:1;min-height:0}
/* Left rail. Its band header shares one height with the right column's, so both lists start on the same line. */
.ar-side{flex:none;display:flex;flex-direction:column;width:220px;min-height:0;border-right:1px solid var(--ar-line-strong)}
.ar-side__head{flex:none;display:flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-bottom:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.ar-side__list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:1px;padding:6px 8px 10px}
.ar-side__foot{flex:none;display:flex;flex-direction:column;gap:1px;padding:10px 16px 12px;border-top:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums}
.ar-side__foot span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-group{position:relative;display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none;transition:background-color .12s ease,color .12s ease}
.ar-group:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
/* The selected group adds its own hue to the base surface: a tinted fill plus a
   2px accent rail on the left edge, so selection reads at a glance even while
   another row is hovered. */
.ar-group[data-active="true"]{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 12%,var(--dsw-alias-bg-base) 88%);color:var(--dsw-alias-label-primary);font-weight:600}
.ar-group[data-active="true"]:hover{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 18%,var(--dsw-alias-bg-base) 82%)}
.ar-group[data-active="true"]::before{content:"";position:absolute;left:3px;top:7px;bottom:7px;width:2px;border-radius:1px;background:var(--ar-group-ink,var(--dsw-alias-brand-primary))}
.ar-group[data-dim="true"]{opacity:.45}
.ar-group:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-group__name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600;color:var(--ar-group-ink,var(--dsw-alias-label-primary))}
.ar-group[data-active="true"] .ar-group__name{font-weight:700}
.ar-group__count{flex:none;font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.85}
/* Right column: one band header, then the group's lists. Text sits on the 44px rail used by section titles. */
.ar-main{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;padding:0 0 40px}
/* A group switch remounts this wrapper (keyed by group id), replaying the entry animation. */
.ar-view{animation:ar-view-in .26s cubic-bezier(.2,.7,.2,1) both}
.ar-view[data-dir="up"]{--ar-shift:-6px}
.ar-view[data-dir="down"]{--ar-shift:6px}
.ar-main__head{display:flex;align-items:center;gap:12px;height:40px;padding:0 16px 0 44px;border-bottom:1px solid var(--ar-line)}
.ar-main__titles{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.ar-main__title{flex:0 1 auto;min-width:0;margin:0;font-size:16px;line-height:22px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ar-group-ink,var(--dsw-alias-label-primary))}
.ar-main__meta{flex:none;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.ar-main__actions{flex:none;display:flex;align-items:center;gap:4px}
.ar-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color .14s ease,color .14s ease}
.ar-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-sections{display:flex;flex-direction:column;padding:6px 0 0}
.ar-sections>.ar-sec{border-top:1px solid var(--ar-line)}
.ar-sections>.ar-sec:first-child{border-top:0}
.ar-sec__head{position:relative;display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 16px 0 24px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none}
button.ar-sec__head:hover{background:var(--dsw-alias-bg-layer-2)}
.ar-sec__head[data-static="true"]{cursor:default}
.ar-sec__head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-sec__chev{flex:none;display:inline-flex;align-items:center;color:var(--ar-list-ink-soft,var(--dsw-alias-label-secondary));transition:transform .16s ease}
.ar-sec[data-open="true"] .ar-sec__chev{transform:rotate(90deg)}
.ar-sec__title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--ar-list-ink,var(--dsw-alias-label-primary))}
.ar-sec__count{flex:none;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* The card body stays mounted and animates its row from 0fr to 1fr, so both open and close have a height transition; visibility keeps collapsed cards out of the tab order. */
.ar-sec__body{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s linear .24s}
.ar-sec[data-open="true"] .ar-sec__body{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s}
.ar-sec__inner{min-height:0;overflow:hidden}
/* One candy hue per group, cycling. The group title takes the saturated ink, its lists take a
   desaturated ink of the same hue, so colour alone shows the parent/child relation. OKLCH fixes the
   perceived lightness across hues; mixing with the theme's primary label keeps both themes readable. */
.ar-root [data-tone]{--ar-hue:240;--ar-group-ink:color-mix(in oklab,oklch(0.74 0.21 var(--ar-hue)) 70%,var(--dsw-alias-label-primary));--ar-list-ink:color-mix(in oklab,oklch(0.76 0.11 var(--ar-hue)) 70%,var(--dsw-alias-label-primary));--ar-list-ink-soft:color-mix(in oklab,oklch(0.76 0.11 var(--ar-hue)) 50%,var(--dsw-alias-label-secondary))}
.ar-root [data-tone="0"]{--ar-hue:20}
.ar-root [data-tone="1"]{--ar-hue:45}
.ar-root [data-tone="2"]{--ar-hue:75}
.ar-root [data-tone="3"]{--ar-hue:150}
.ar-root [data-tone="4"]{--ar-hue:195}
.ar-root [data-tone="5"]{--ar-hue:240}
.ar-root [data-tone="6"]{--ar-hue:285}
.ar-root [data-tone="7"]{--ar-hue:330}
.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:10px;padding:6px 16px 12px 44px}
.ar-sec[data-open="true"] .ar-grid{animation:ar-fade-in .2s ease both}
.ar-sec:not([data-open="true"]) .ar-grid{opacity:0;transition:opacity .18s ease}
.ar-card{position:relative;display:flex;align-items:flex-start;gap:9px;min-width:0;padding:11px 12px;border:.5px solid var(--ar-line);border-radius:10px;background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift)),var(--dsw-alias-label-primary) var(--ar-card-lift));color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;text-decoration:none;user-select:none;-webkit-touch-callout:none;-webkit-user-drag:none;transition:border-color .16s ease,background-color .16s ease}
/* Card surface = the sidebar fill nudged a fixed step towards the theme's text colour, so any theme (even one whose fill equals its base) keeps a visible card/background delta. Tune it with the --ar-card-lift variables on .ar-root. */
.ar-card:hover{border-color:var(--dsw-alias-border-l2);background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift-hover)),var(--dsw-alias-label-primary) var(--ar-card-lift-hover))}
.ar-card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
/* Drag feedback: the source keeps a dashed blank box until the pointer leaves
   it; then the box collapses, siblings glide into the gap, a floating copy
   follows the pointer, and a translucent copy previews the target slot. */
[data-sort-placeholder="true"]{pointer-events:none!important;background:transparent!important;border-color:transparent!important;box-shadow:none!important;outline:1px dashed color-mix(in oklab,var(--dsw-alias-label-secondary) 50%,transparent);outline-offset:-1px}
[data-sort-placeholder="true"]>*{visibility:hidden!important}
[data-sort-placeholder="true"] .ar-grid{animation:none!important}
[data-sort-preview="true"]{opacity:.55;pointer-events:none!important;box-shadow:none!important;filter:saturate(.9);transition:none!important}
[data-sort-preview="true"] .ar-grid,[data-sort-ghost="true"] .ar-grid{animation:none!important}
[data-sort-preview="true"] .ar-sec__body,[data-sort-ghost="true"] .ar-sec__body{transition:none!important}
[data-sort-ghost="true"]{position:fixed!important;z-index:1300;margin:0!important;pointer-events:none!important;opacity:.98;box-shadow:0 18px 44px rgba(0,0,0,.28);transition:none!important;will-change:left,top}
.ar-group[data-sort-ghost="true"],.ar-sec[data-sort-ghost="true"]{background:var(--dsw-alias-bg-base)}
.ar-root[data-sorting="true"],.ar-root[data-sorting="true"] *{cursor:grabbing!important;user-select:none!important}
.ar-card__title{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ar-fav{flex:none;width:18px;height:18px;border-radius:4px;object-fit:contain}
.ar-fav--letter{display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;line-height:1}
.ar-state{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 24px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.ar-state__title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}
.ar-state__hint{max-width:420px;font-size:12.5px;line-height:18px}
.ar-toast{position:fixed;z-index:1200;left:50%;bottom:26px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 48px));padding:7px 14px;border:1px solid var(--ar-line);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 28px rgba(0,0,0,.2)}
@keyframes ar-fade-in{from{opacity:0}}
@keyframes ar-view-in{from{opacity:0;transform:translateY(var(--ar-shift,6px))}}
.ar-toast{animation:ar-fade-in .16s ease both}
@media (prefers-reduced-motion:reduce){.ar-toast,.ar-view,.ar-sec__body,.ar-sec__chev,.ar-grid,.ar-card{animation:none;transition:none}}`

module.exports = { CSS }
      },
    }

    var __cache = Object.create(null)

    /** Resolves a sibling request against the requesting module's directory. */
    function __resolve(from, spec) {
      if (spec.slice(0, 2) !== './') {
        throw new Error('dsh-archive: unsupported local require "' + spec + '"')
      }
      var base = from.slice(0, from.lastIndexOf('/') + 1)
      var parts = (base + spec.slice(2)).split('/')
      var resolved = []
      for (var index = 0; index < parts.length; index += 1) {
        var part = parts[index]
        if (part === '' || part === '.') continue
        if (part === '..') resolved.pop()
        else resolved.push(part)
      }
      return './' + resolved.join('/')
    }

    /** Materializes one local module exactly once, like the real loader. */
    function __load(id) {
      if (__cache[id] !== undefined) return __cache[id].exports
      var definition = __modules[id]
      if (definition === undefined) {
        throw new Error('dsh-archive: missing bundled module "' + id + '"')
      }
      var record = { exports: {} }
      __cache[id] = record
      var localRequire = function (spec) {
        if (spec.charAt(0) !== '.') return require(spec)
        return __load(__resolve(id, spec))
      }
      definition(record, record.exports, localRequire)
      if (
        record.exports !== null &&
        (typeof record.exports === 'object' || typeof record.exports === 'function')
      ) {
        Object.defineProperty(record.exports, Symbol.toStringTag, {
          value: 'Module',
          configurable: true,
        })
      }
      return record.exports
    }

    return __load('./index.js')
  },
})
