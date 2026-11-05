/**
 * The Archive page: state ownership plus the two-column layout. Data loading,
 * local persistence, ordering, selection, search, and the header/side sections
 * each live in a small module; this file wires them together.
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
const { fetchLibrary, openBookmark: requestOpen, mutateLibrary: requestMutation } = require('./api.js')
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
  pruneOrder,
  orderListBookmarks,
  filterListBookmarks,
} = require('./order.js')
const {
  toggleId,
  selectedEntries,
  countsByGroup,
  groupCount,
  hiddenByQuery,
  targetStats,
  entryMap,
} = require('./selection.js')
const { BatchDeleteDialog, MoveDialog, SelectionSummary } = require('./dialogs.js')

/**
 * @param props - the slot's locale-injected `t` seat.
 * @returns the full two-column library, or a loading/error/empty placeholder.
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
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [confirmingId, setConfirmingId] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [dialogError, setDialogError] = useState('')
  const [busy, setBusy] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(null)
  const mainRef = useRef(null)
  const mountedRef = useRef(true)
  const countButtonRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const moveButtonRef = useRef(null)
  const deleteButtonRef = useRef(null)
  const dialogTriggerRef = useRef(null)

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

        const saved = readSavedState()
        const preferred =
          (saved.groupId && payload.groups.some((group) => group.id === saved.groupId)
            ? saved.groupId
            : null) ?? payload.groups[0]?.id ?? null
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
        setSelectionMode(false)
        setSelected(new Set())
        setConfirmingId(null)
        setDialog(null)
        setDialogError('')
        setSummaryOpen(false)
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

  useEffect(() => {
    if (focusRequest === null) return undefined
    const frame = requestAnimationFrame(() => {
      for (const selector of focusRequest.selectors) {
        const element = document.querySelector(selector)
        if (element !== null && typeof element.focus === 'function') {
          element.focus({ preventScroll: true })
          return
        }
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [focusRequest, collection])

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
  const visibleCardCount = useMemo(
    () => visibleLists.reduce((total, list) => total + list.bookmarks.length, 0),
    [visibleLists],
  )
  const groupMatches = useMemo(
    () => countGroupMatches(groups, queryText),
    [groups, queryText],
  )

  const entries = useMemo(
    () => selectedEntries(groups, order, selected),
    [groups, order, selected],
  )
  const selectedByGroup = useMemo(() => countsByGroup(entries), [entries])
  const selectedGroupCount = useMemo(() => groupCount(entries), [entries])
  const hiddenSelected = useMemo(
    () => hiddenByQuery(entries, queryText),
    [entries, queryText],
  )
  const selectionSummaryOpen = summaryOpen && entries.length > 0

  const dialogEntries = useMemo(() => {
    if (dialog === null) return []
    const lookup = entryMap(entries)
    return dialog.ids.map((id) => lookup.get(id)).filter(Boolean)
  }, [dialog, entries])

  const stats = collection?.stats ?? { groups: 0, lists: 0, bookmarks: 0 }
  const canMutate = collection?.capabilities?.mutate === true

  const focusLater = useCallback((selectors) => {
    setFocusRequest({ selectors, nonce: Date.now() + Math.random() })
  }, [])

  const applyPayload = useCallback((payload) => {
    setCollection(payload)
    setOrder((current) => pruneOrder(current, payload))
    setActiveGroupId((current) =>
      payload.groups.some((group) => group.id === current)
        ? current
        : payload.groups[0]?.id ?? null,
    )
  }, [])

  const resetInteraction = useCallback(() => {
    setSelectionMode(false)
    setSelected(new Set())
    setConfirmingId(null)
    setDialog(null)
    setDialogError('')
    setSummaryOpen(false)
  }, [])

  const handleMutationError = useCallback(
    (error) => {
      if (error?.code === 'stale-library' && error.library) {
        applyPayload(error.library)
        resetInteraction()
        setToast(t('stale'))
        focusLater(['[data-group-title="true"]', '.ar-group[data-active="true"]'])
        return true
      }
      if (error?.code === 'library-readonly') {
        setDialogError(t('readonly'))
        setToast(t('readonly'))
        return true
      }
      return false
    },
    [applyPayload, resetInteraction, focusLater, t],
  )

  const findBookmarkList = useCallback(
    (bookmarkId) => {
      for (const group of sourceGroups) {
        for (const list of group.lists) {
          if (list.bookmarks.some((bookmark) => bookmark.id === bookmarkId)) {
            return { group, list }
          }
        }
      }
      return null
    },
    [sourceGroups],
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

  const deleteOne = useCallback(
    async (bookmarkId) => {
      if (busy || collection === null || !canMutate) return
      const found = findBookmarkList(bookmarkId)
      let nextId = null
      if (found !== null) {
        const ordered = orderListBookmarks(found.list, order)
        const index = ordered.bookmarks.findIndex((bookmark) => bookmark.id === bookmarkId)
        const neighbour =
          index === -1 ? null : ordered.bookmarks[index + 1] ?? ordered.bookmarks[index - 1] ?? null
        nextId = neighbour === null ? null : neighbour.id
      }
      const listId = found === null ? null : found.list.id
      const listOpen = listId !== null && (queryText !== '' || expanded[listId] !== false)

      setBusy(true)
      try {
        const payload = await requestMutation(
          { type: 'delete', ids: [bookmarkId] },
          collection.revision,
        )
        applyPayload(payload)
        setConfirmingId(null)
        setToast(t('delete.done.one'))
        const selectors = []
        if (listOpen && nextId !== null) selectors.push('[data-focus-id="' + nextId + '"]')
        if (listId !== null) selectors.push('[data-list-head="' + listId + '"]')
        selectors.push('[data-group-title="true"]')
        focusLater(selectors)
      } catch (error) {
        if (handleMutationError(error)) return
        setToast(t('delete.failed'))
      } finally {
        setBusy(false)
      }
    },
    [
      busy,
      collection,
      canMutate,
      findBookmarkList,
      order,
      queryText,
      expanded,
      applyPayload,
      focusLater,
      handleMutationError,
      t,
    ],
  )

  const confirmDeleteCard = useCallback(() => {
    if (confirmingId === null) return
    void deleteOne(confirmingId)
  }, [confirmingId, deleteOne])

  const cancelDeleteCard = useCallback((bookmarkId) => {
    if (busy) return
    // The card animates its confirm overlay out before calling back, so a
    // delayed cancel from an old card must not close a newer card's overlay.
    setConfirmingId((current) => (bookmarkId === undefined || current === bookmarkId ? null : current))
  }, [busy])

  const requestDeleteCard = useCallback(
    (bookmarkId) => {
      if (busy || !canMutate) return
      setConfirmingId(bookmarkId)
      setSummaryOpen(false)
    },
    [busy, canMutate],
  )

  const confirmBatchDelete = useCallback(async () => {
    if (dialog === null || dialog.type !== 'delete' || busy || collection === null || !canMutate) return
    const ids = dialog.ids
    setBusy(true)
    setDialogError('')
    try {
      const payload = await requestMutation({ type: 'delete', ids }, collection.revision)
      applyPayload(payload)
      resetInteraction()
      setToast(
        ids.length === 1 ? t('delete.done.one') : t('delete.done.many', { n: ids.length }),
      )
      focusLater(['[data-group-title="true"]', '.ar-group[data-active="true"]'])
    } catch (error) {
      if (handleMutationError(error)) return
      setDialogError(t('delete.failed'))
    } finally {
      setBusy(false)
    }
  }, [
    dialog,
    busy,
    collection,
    canMutate,
    applyPayload,
    resetInteraction,
    focusLater,
    handleMutationError,
    t,
  ])

  const confirmMove = useCallback(
    async (target) => {
      if (dialog === null || dialog.type !== 'move' || busy || collection === null || !canMutate) return
      const targetGroup = collection.groups.find((group) => group.id === target.groupId)
      const targetList =
        targetGroup === undefined
          ? undefined
          : targetGroup.lists.find((list) => list.id === target.listId)
      if (targetGroup === undefined || targetList === undefined) {
        setDialogError(t('move.failed'))
        return
      }

      const ids = dialog.ids
      const moving = targetStats(entries, target.listId).moving
      setBusy(true)
      setDialogError('')
      try {
        const payload = await requestMutation(
          {
            type: 'move',
            ids,
            target: { groupId: target.groupId, listId: target.listId },
          },
          collection.revision,
        )
        applyPayload(payload)
        resetInteraction()
        setToast(
          t('move.done', {
            n: moving,
            group: targetGroup.name,
            list: targetList.title,
          }),
        )

        if (target.groupId === activeGroupId) {
          setExpanded((current) => ({ ...current, [target.listId]: true }))
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const section = document.querySelector(
                '[data-section-id="' + target.listId + '"]',
              )
              if (section !== null && typeof section.scrollIntoView === 'function') {
                section.scrollIntoView({ block: 'nearest' })
              }
            })
          })
          focusLater([
            '[data-list-head="' + target.listId + '"]',
            '[data-group-title="true"]',
          ])
        } else {
          focusLater(['[data-group-title="true"]', '.ar-group[data-active="true"]'])
        }
      } catch (error) {
        if (handleMutationError(error)) return
        setDialogError(t('move.failed'))
      } finally {
        setBusy(false)
      }
    },
    [
      dialog,
      busy,
      collection,
      canMutate,
      entries,
      activeGroupId,
      applyPayload,
      resetInteraction,
      focusLater,
      handleMutationError,
      t,
    ],
  )

  const openBatchDelete = useCallback(() => {
    if (busy || entries.length === 0 || !canMutate) return
    dialogTriggerRef.current = deleteButtonRef.current
    setDialog({ type: 'delete', ids: entries.map((entry) => entry.bookmark.id) })
    setDialogError('')
  }, [busy, entries, canMutate])

  const openMove = useCallback(() => {
    if (busy || entries.length === 0 || !canMutate) return
    dialogTriggerRef.current = moveButtonRef.current
    setDialog({ type: 'move', ids: entries.map((entry) => entry.bookmark.id) })
    setDialogError('')
  }, [busy, entries, canMutate])

  const closeDialog = useCallback(() => {
    if (busy) return
    const trigger = dialogTriggerRef.current
    setDialog(null)
    setDialogError('')
    if (trigger !== null && trigger.isConnected) {
      requestAnimationFrame(() => trigger.focus())
    }
  }, [busy])

  const enterSelection = useCallback(() => {
    if (busy || !canMutate) return
    setSelectionMode(true)
    setSummaryOpen(false)
  }, [busy, canMutate])

  const exitSelection = useCallback(() => {
    if (busy) return
    setSelectionMode(false)
    setSelected(new Set())
    setSummaryOpen(false)
    setConfirmingId(null)
    focusLater(['.ar-main__select', '[data-group-title="true"]'])
  }, [busy, focusLater])

  const toggleSelect = useCallback(
    (bookmarkId) => {
      if (busy || !canMutate) return
      const next = toggleId(selected, bookmarkId)
      setSelected(next)
      setSelectionMode(true)
      setConfirmingId(null)
      if (next.size === 0) setSummaryOpen(false)
    },
    [busy, selected, canMutate],
  )

  const selectGroup = useCallback(
    (groupId) => {
      if (busy) return
      setActiveGroupId(groupId)
      setConfirmingId(null)
      setSummaryOpen(false)
    },
    [busy],
  )

  const changeQuery = useCallback(
    (value) => {
      if (busy) return
      setQuery(value)
      setConfirmingId(null)
      setSummaryOpen(false)
    },
    [busy],
  )

  const toggleList = useCallback(
    (listId) => {
      if (busy) return
      setExpanded((current) => {
        const open = current[listId] !== false
        return { ...current, [listId]: !open }
      })
      setConfirmingId(null)
    },
    [busy],
  )

  const expandAll = useCallback(() => {
    if (busy) return
    setExpanded({})
  }, [busy])

  const collapseAll = useCallback(() => {
    if (busy) return
    const next = {}
    for (const list of activeLists) next[list.id] = false
    setExpanded(next)
  }, [busy, activeLists])

  const reorderGroups = useCallback(
    (from, to) => {
      if (busy) return
      setOrder((current) => {
        const next = moveId(groupIds, from, to)
        return next === groupIds ? current : { ...current, groups: next }
      })
    },
    [busy, groupIds],
  )

  const reorderLists = useCallback(
    (from, to) => {
      if (busy || activeGroup === null) return
      setOrder((current) => {
        const next = moveId(visibleListIds, from, to)
        const key = activeGroup.id
        return next === visibleListIds
          ? current
          : { ...current, lists: { ...current.lists, [key]: next } }
      })
    },
    [busy, activeGroup, visibleListIds],
  )

  const reorderBookmarks = useCallback(
    (listId, ids, from, to) => {
      if (busy) return
      setOrder((current) => {
        const next = moveId(ids, from, to)
        return next === ids
          ? current
          : { ...current, bookmarks: { ...current.bookmarks, [listId]: next } }
      })
    },
    [busy],
  )

  const toggleSummary = useCallback(() => {
    if (busy || entries.length === 0) return
    setSummaryOpen((current) => !current)
  }, [busy, entries.length])

  const closeSummary = useCallback(() => {
    setSummaryOpen(false)
    requestAnimationFrame(() => {
      if (countButtonRef.current !== null && countButtonRef.current.disabled !== true) {
        countButtonRef.current.focus()
      } else if (cancelButtonRef.current !== null) {
        cancelButtonRef.current.focus()
      }
    })
  }, [])

  const removeFromSummary = useCallback(
    (bookmarkId) => {
      const next = new Set(selected)
      next.delete(bookmarkId)
      setSelected(next)
      if (next.size === 0) setSummaryOpen(false)
    },
    [selected],
  )

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    setSummaryOpen(false)
  }, [])

  const jumpToGroup = useCallback((groupId) => {
    setActiveGroupId(groupId)
    setSummaryOpen(false)
    setConfirmingId(null)
  }, [])

  /* Esc leaves selection mode; the summary, a dialog, or a card confirm owns
     the key first when one of them is open. */
  useEffect(() => {
    if (!selectionMode) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (dialog !== null || confirmingId !== null || summaryOpen) return
      event.preventDefault()
      exitSelection()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectionMode, dialog, confirmingId, summaryOpen, exitSelection])

  const header = h(PageHeader, { t, query, onQueryChange: changeQuery, busy })
  const allListsOpen =
    activeGroup !== null &&
    activeLists.length > 0 &&
    activeLists.every((list) => expanded[list.id] !== false)

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

  if (collection !== null && groups.length === 0) {
    return h(
      'div',
      { className: 'ar-root' },
      h('style', { key: 'styles' }, CSS),
      header,
      h(
        'div',
        { className: 'ar-state' },
        h('div', { className: 'ar-state__title' }, t('empty.library')),
        h('div', { className: 'ar-state__hint' }, t('empty.hint')),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn',
            style: { borderColor: 'var(--dsw-alias-border-l2)' },
            onClick: () => setAttempt((value) => value + 1),
          },
          t('reload'),
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
    selectedByGroup,
    activeGroupId: activeGroup === null ? null : activeGroup.id,
    selectionMode,
    busy,
    dragDisabled: confirmingId !== null || dialog !== null,
    onSelect: selectGroup,
    onReorder: reorderGroups,
  })

  const mainChildren = []

  if (activeGroup !== null) {
    const showExpand = queryText === '' && activeLists.length > 0
    const showSelect = canMutate && (selectionMode || visibleCardCount > 0)
    const meta =
      queryText === ''
        ? [
            t('count.lists', { n: activeLists.length }),
            t('count.bookmarks', { n: activeGroup.count }),
          ].join(' · ')
        : t('count.match', {
            n: visibleLists.reduce((total, list) => total + list.count, 0),
          })

    mainChildren.push(
      h(
        'div',
        { className: 'ar-main__head', key: 'head' },
        h(
          'div',
          { className: 'ar-main__titles' },
          h(
            'h2',
            {
              className: 'ar-main__title',
              title: activeGroup.name,
              'data-group-title': 'true',
              tabIndex: -1,
            },
            activeGroup.name,
          ),
          h('div', { className: 'ar-main__meta' }, meta),
        ),
        showExpand || showSelect
          ? h(
              'div',
              { className: 'ar-main__actions' },
              showExpand
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'ar-btn ar-main__expand',
                      disabled: busy,
                      onClick: allListsOpen ? collapseAll : expandAll,
                    },
                    allListsOpen ? t('collapseAll') : t('expandAll'),
                  )
                : null,
              showSelect
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'ar-btn ar-main__select',
                      'data-active': selectionMode ? 'true' : undefined,
                      disabled: busy,
                      onClick: selectionMode ? exitSelection : enterSelection,
                    },
                    selectionMode ? t('select.exit') : t('select'),
                  )
                : null,
            )
          : null,
      ),
    )

    if (queryText !== '' && visibleLists.length === 0) {
      mainChildren.push(
        h(
          'div',
          { className: 'ar-state', key: 'empty' },
          h(
            'div',
            { className: 'ar-state__title' },
            t('status.noMatch', { q: query.trim() }),
          ),
        ),
      )
    } else if (queryText === '' && activeLists.length === 0) {
      mainChildren.push(
        h(
          'div',
          { className: 'ar-state', key: 'empty-group' },
          h('div', { className: 'ar-state__title' }, t('empty.group')),
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
            disabled:
              queryText !== '' ||
              visibleListIds.length < 2 ||
              busy ||
              selectionMode ||
              confirmingId !== null,
            onReorder: reorderLists,
          },
          visibleLists.map((list) => {
            const open = queryText === '' ? expanded[list.id] !== false : true
            return h(ListSection, {
              key: list.id,
              t,
              list,
              open,
              collapsible: queryText === '',
              sortable: queryText === '',
              selectionMode,
              selected,
              busy,
              canMutate,
              confirmingId,
              deleteBusy: busy,
              onToggle: () => toggleList(list.id),
              onOpen: openBookmark,
              onToggleSelect: toggleSelect,
              onRequestDelete: requestDeleteCard,
              onCancelDelete: cancelDeleteCard,
              onConfirmDelete: confirmDeleteCard,
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

  let countText = t('select.count', { n: entries.length })
  if (selectedGroupCount > 1) {
    countText += ' · ' + t('select.groups', { m: selectedGroupCount })
  }
  if (queryText !== '' && hiddenSelected > 0) {
    countText += ' · ' + t('select.hidden', { k: hiddenSelected })
  }

  const dock = selectionMode && canMutate
    ? h(
        'div',
        { className: 'ar-bar-dock', key: 'bar' },
        selectionSummaryOpen
          ? h(SelectionSummary, {
              t,
              entries,
              onRemove: removeFromSummary,
              onClear: clearSelection,
              onJump: jumpToGroup,
              onClose: closeSummary,
            })
          : null,
        h(
          'div',
          { className: 'ar-bar', role: 'toolbar', 'aria-label': t('select.bar') },
          h(
            'button',
            {
              type: 'button',
              className: 'ar-bar__count',
              ref: countButtonRef,
              'aria-expanded': selectionSummaryOpen ? 'true' : 'false',
              'aria-live': 'polite',
              title: entries.length === 0 ? t('select.emptyHint') : countText,
              disabled: entries.length === 0 || busy,
              onClick: toggleSummary,
            },
            countText,
          ),
          h(
            'div',
            { className: 'ar-bar__actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ar-bar__btn',
                ref: moveButtonRef,
                disabled: entries.length === 0 || busy,
                onClick: openMove,
              },
              t('action.move'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ar-bar__btn ar-bar__btn--danger',
                ref: deleteButtonRef,
                disabled: entries.length === 0 || busy,
                onClick: openBatchDelete,
              },
              t('action.delete'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ar-bar__btn ar-bar__btn--ghost',
                ref: cancelButtonRef,
                disabled: busy,
                onClick: exitSelection,
              },
              t('cancel'),
            ),
          ),
        ),
      )
    : null

  let dialogNode = null
  if (dialog !== null && dialog.type === 'delete') {
    dialogNode = h(BatchDeleteDialog, {
      t,
      entries: dialogEntries,
      busy,
      error: dialogError,
      onCancel: closeDialog,
      onConfirm: confirmBatchDelete,
    })
  } else if (dialog !== null && dialog.type === 'move') {
    dialogNode = h(MoveDialog, {
      t,
      groups,
      activeGroupId: activeGroup === null ? null : activeGroup.id,
      entries: dialogEntries,
      busy,
      error: dialogError,
      onCancel: closeDialog,
      onConfirm: confirmMove,
    })
  }

  return h(
    'div',
    {
      className: 'ar-root',
      'data-select-mode': selectionMode ? 'true' : 'false',
      'data-dialog-open': dialog !== null ? 'true' : 'false',
      'data-busy': busy ? 'true' : 'false',
    },
    h('style', { key: 'styles' }, CSS),
    header,
    h('div', { className: 'ar-body' }, side, main),
    dock,
    dialogNode,
    toast === null ? null : h('div', { className: 'ar-toast', role: 'status' }, toast),
  )
}

module.exports = { Panel }
