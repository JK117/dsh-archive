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
