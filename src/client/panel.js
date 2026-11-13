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
const { MoreMenu } = require('./menu.js')
const { EditGlyph, TrashGlyph } = require('./glyphs.js')
const { TONE_COUNT, MAX_IMPORT_BYTES, RAIL_WIDTH_MAX } = require('./constants.js')
const { railCeiling, clampRailWidth, readSavedRailWidth, writeSavedRailWidth } = require('./rail.js')
const { RailResizer } = require('./resizer.js')
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
  pruneExpanded,
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
  pruneSelected,
} = require('./selection.js')
const {
  renameMaps,
  remapId,
  remapOrderForRename,
  remapExpandedForRename,
  remapSelectedForRename,
} = require('./remap.js')
const {
  BatchDeleteDialog,
  StructureDeleteDialog,
  RenameDialog,
  MoveDialog,
  SelectionSummary,
  AddBookmarkDialog,
  ImportDialog,
} = require('./dialogs.js')

/** A quick, tolerant shape count for the import confirmation, not validation. */
function summarizeImport(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (!Array.isArray(parsed.groups)) return null

  let groups = 0
  let lists = 0
  let bookmarks = 0
  for (const rawGroup of parsed.groups) {
    if (rawGroup === null || typeof rawGroup !== 'object') continue
    groups += 1
    const rawLists = Array.isArray(rawGroup.lists) ? rawGroup.lists : []
    for (const rawList of rawLists) {
      if (rawList === null || typeof rawList !== 'object') continue
      lists += 1
      if (Array.isArray(rawList.bookmarks)) bookmarks += rawList.bookmarks.length
      else if (Array.isArray(rawList.cards)) bookmarks += rawList.cards.length
    }
  }
  return { groups, lists, bookmarks }
}

/**
 * @param props - the slot's locale-injected `t` seat.
 * @returns the full two-column library, or a loading/error/empty placeholder.
 */
function Panel(props) {
  const t = props.t
  const [status, setStatus] = useState('loading')
  const [railWidth, setRailWidth] = useState(readSavedRailWidth)
  const [railMax, setRailMax] = useState(RAIL_WIDTH_MAX)
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
  const [entryDialog, setEntryDialog] = useState(null)
  const [entryError, setEntryError] = useState('')
  const [importDialog, setImportDialog] = useState(null)
  const [importError, setImportError] = useState('')
  const [busy, setBusy] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(null)
  const mainRef = useRef(null)
  const bodyRef = useRef(null)
  const railWidthRef = useRef(railWidth)
  const mountedRef = useRef(true)
  railWidthRef.current = railWidth
  const countButtonRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const moveButtonRef = useRef(null)
  const deleteButtonRef = useRef(null)
  const dialogTriggerRef = useRef(null)
  const fileInputRef = useRef(null)

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
        setEntryDialog(null)
        setEntryError('')
        setImportDialog(null)
        setImportError('')
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

  /* The divider is clamped against the live body width, so a stored wide rail
     can never squeeze the cards off-screen when the page itself is narrow. */
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (body === null) return undefined
    const sync = () => {
      const ceiling = railCeiling(body.clientWidth)
      setRailMax(ceiling)
      const next = clampRailWidth(railWidthRef.current, ceiling)
      if (next !== railWidthRef.current) {
        railWidthRef.current = next
        writeSavedRailWidth(next)
        setRailWidth(next)
      }
    }
    sync()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(sync)
    observer.observe(body)
    return () => observer.disconnect()
  }, [status])

  const changeRailWidth = useCallback((next) => {
    railWidthRef.current = next
    setRailWidth(next)
  }, [])
  const commitRailWidth = useCallback((next) => writeSavedRailWidth(next), [])

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
    if (dialog === null || !Array.isArray(dialog.ids)) return []
    const lookup = entryMap(entries)
    return dialog.ids.map((id) => lookup.get(id)).filter(Boolean)
  }, [dialog, entries])

  const stats = collection?.stats ?? { groups: 0, lists: 0, bookmarks: 0 }
  const canMutate = collection?.capabilities?.mutate === true
  /* The bottom bar is only useful with a non-empty selection; an empty one
     leaves the grid in its normal state instead of parking an idle toolbar. */
  const selectionBarVisible = selectionMode && canMutate && entries.length > 0

  const focusLater = useCallback((selectors) => {
    setFocusRequest({ selectors, nonce: Date.now() + Math.random() })
  }, [])

  const applyPayload = useCallback((payload, preferredGroupId) => {
    setCollection(payload)
    setOrder((current) => pruneOrder(current, payload))
    setActiveGroupId((current) => {
      if (
        preferredGroupId !== undefined &&
        preferredGroupId !== null &&
        payload.groups.some((group) => group.id === preferredGroupId)
      ) {
        return preferredGroupId
      }
      return payload.groups.some((group) => group.id === current)
        ? current
        : payload.groups[0]?.id ?? null
    })
  }, [])

  /**
   * A rename changes the content-derived ids of everything below the renamed
   * node, so the local selection, expansion, and drag order must be carried
   * over with the Host's old→new pairs instead of being pruned away.
   */
  const applyRenamePayload = useCallback((payload, renamed) => {
    const maps = renameMaps(renamed)
    setCollection(payload)
    setOrder((current) => pruneOrder(remapOrderForRename(current, renamed), payload))
    setExpanded((current) => remapExpandedForRename(current, renamed))
    setSelected((current) => remapSelectedForRename(current, renamed))
    setConfirmingId((current) =>
      current === null ? null : remapId(current, maps.bookmarks),
    )
    setActiveGroupId((current) => {
      if (
        typeof renamed?.groupId === 'string' &&
        payload.groups.some((group) => group.id === renamed.groupId)
      ) {
        return renamed.groupId
      }
      return payload.groups.some((group) => group.id === current)
        ? current
        : payload.groups[0]?.id ?? null
    })
  }, [])

  const resetInteraction = useCallback(() => {
    setSelectionMode(false)
    setSelected(new Set())
    setConfirmingId(null)
    setDialog(null)
    setDialogError('')
    setEntryDialog(null)
    setEntryError('')
    setImportDialog(null)
    setImportError('')
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

  const openAddBookmark = useCallback(() => {
    if (busy || !canMutate) return
    setEntryDialog({ mode: 'page', trigger: '.ar-header__add' })
    setEntryError('')
  }, [busy, canMutate])

  const openAddToList = useCallback(
    (listId) => {
      if (busy || !canMutate || activeGroup === null) return
      setEntryDialog({
        mode: 'list',
        groupId: activeGroup.id,
        listId,
        trigger: '[data-list-add="' + listId + '"]',
      })
      setEntryError('')
    },
    [busy, canMutate, activeGroup],
  )

  const closeEntryDialog = useCallback(() => {
    if (busy) return
    const trigger = entryDialog === null ? null : entryDialog.trigger
    setEntryDialog(null)
    setEntryError('')
    if (trigger !== null) {
      requestAnimationFrame(() => {
        const element = document.querySelector(trigger)
        if (element !== null && typeof element.focus === 'function') element.focus()
      })
    }
  }, [busy, entryDialog])

  const confirmAddBookmark = useCallback(
    async (input) => {
      if (entryDialog === null || busy || collection === null || !canMutate) return
      setBusy(true)
      setEntryError('')
      try {
        const payload = await requestMutation(
          { type: 'create', bookmark: input.bookmark, target: input.target },
          collection.revision,
        )
        applyPayload(payload)
        setEntryDialog(null)
        setQuery('')
        setConfirmingId(null)
        setSummaryOpen(false)
        setToast(t('add.done'))

        const created = payload.created ?? null
        if (created !== null && created.groupId) setActiveGroupId(created.groupId)
        if (created !== null && created.listId) {
          setExpanded((current) => ({ ...current, [created.listId]: true }))
        }

        const selectors = []
        if (created !== null && created.bookmarkId) {
          selectors.push('[data-focus-id="' + created.bookmarkId + '"]')
        }
        if (created !== null && created.listId) {
          selectors.push('[data-list-head="' + created.listId + '"]')
        }
        selectors.push('[data-group-title="true"]')
        focusLater(selectors)

        if (created !== null && created.listId) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const section = document.querySelector(
                '[data-section-id="' + created.listId + '"]',
              )
              if (section !== null && typeof section.scrollIntoView === 'function') {
                section.scrollIntoView({ block: 'nearest' })
              }
            })
          })
        }
      } catch (error) {
        if (handleMutationError(error)) return
        if (error?.code === 'duplicate-bookmark') setEntryError(t('add.duplicate'))
        else if (error?.code === 'invalid-url') setEntryError(t('add.invalidUrl'))
        else setEntryError(t('add.failed'))
      } finally {
        setBusy(false)
      }
    },
    [
      entryDialog,
      busy,
      collection,
      canMutate,
      applyPayload,
      focusLater,
      handleMutationError,
      t,
    ],
  )

  const pickImportFile = useCallback(() => {
    if (busy) return
    if (fileInputRef.current !== null) fileInputRef.current.click()
  }, [busy])

  const handleImportFile = useCallback(
    async (file) => {
      if (busy || file === null || file === undefined) return

      if (file.size > MAX_IMPORT_BYTES) {
        setImportDialog({
          fileName: file.name,
          fileSize: file.size,
          data: null,
          summary: null,
          parseError: t('import.tooLarge'),
        })
        setImportError('')
        return
      }

      let source
      try {
        source = await file.text()
      } catch {
        if (!mountedRef.current) return
        setImportDialog({
          fileName: file.name,
          fileSize: file.size,
          data: null,
          summary: null,
          parseError: t('import.parseFailed'),
        })
        setImportError('')
        return
      }
      if (!mountedRef.current) return

      let parsed
      try {
        parsed = JSON.parse(source.replace(/^\uFEFF/, ''))
      } catch {
        setImportDialog({
          fileName: file.name,
          fileSize: file.size,
          data: null,
          summary: null,
          parseError: t('import.parseFailed'),
        })
        setImportError('')
        return
      }

      const summary = summarizeImport(parsed)
      setImportDialog({
        fileName: file.name,
        fileSize: file.size,
        data: summary === null ? null : parsed,
        summary,
        parseError: summary === null ? t('import.shapeFailed') : '',
      })
      setImportError('')
    },
    [busy, t],
  )

  const closeImportDialog = useCallback(() => {
    if (busy) return
    setImportDialog(null)
    setImportError('')
    requestAnimationFrame(() => {
      const element = document.querySelector('.ar-header__import')
      if (element !== null && typeof element.focus === 'function') element.focus()
    })
  }, [busy])

  const confirmImport = useCallback(async () => {
    if (
      importDialog === null ||
      importDialog.data === null ||
      busy ||
      collection === null ||
      !canMutate
    ) {
      return
    }

    setBusy(true)
    setImportError('')
    try {
      const payload = await requestMutation(
        { type: 'import', data: importDialog.data },
        collection.revision,
      )
      applyPayload(payload)
      setImportDialog(null)
      setQuery('')
      setConfirmingId(null)
      setSummaryOpen(false)

      const info = payload.imported ?? { groups: 0, lists: 0, bookmarks: 0, skipped: 0 }
      const parts = []
      if (info.bookmarks > 0) parts.push(t('import.done', { n: info.bookmarks }))
      if (info.groups > 0 || info.lists > 0) {
        parts.push(t('import.created', { g: info.groups, l: info.lists }))
      }
      if (info.skipped > 0) parts.push(t('import.skipped', { k: info.skipped }))
      if (parts.length === 0) parts.push(t('import.nothing'))
      setToast(parts.join(' · '))
      focusLater(['[data-group-title="true"]', '.ar-group[data-active="true"]'])
    } catch (error) {
      if (handleMutationError(error)) return
      if (error?.code === 'invalid-import') setImportError(t('import.invalid'))
      else if (error?.code === 'request-too-large') setImportError(t('import.tooLarge'))
      else setImportError(t('import.failed'))
    } finally {
      setBusy(false)
    }
  }, [
    importDialog,
    busy,
    collection,
    canMutate,
    applyPayload,
    focusLater,
    handleMutationError,
    t,
  ])

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

  const openStructureDialog = useCallback(
    (type, group, list, trigger) => {
      if (busy || !canMutate || group === null) return
      if (trigger !== undefined && trigger !== null) dialogTriggerRef.current = trigger
      if (type === 'rename-group' || type === 'delete-group') {
        setDialog({ type, groupId: group.id, name: group.name })
      } else {
        setDialog({ type, groupId: group.id, listId: list.id, title: list.title })
      }
      setDialogError('')
      setSummaryOpen(false)
    },
    [busy, canMutate],
  )

  const confirmRename = useCallback(
    async (name) => {
      if (
        dialog === null ||
        (dialog.type !== 'rename-group' && dialog.type !== 'rename-list') ||
        busy ||
        collection === null ||
        !canMutate
      ) {
        return
      }

      const isGroup = dialog.type === 'rename-group'
      const op = isGroup
        ? { type: 'rename-group', groupId: dialog.groupId, name }
        : {
            type: 'rename-list',
            groupId: dialog.groupId,
            listId: dialog.listId,
            title: name,
          }

      setBusy(true)
      setDialogError('')
      try {
        const payload = await requestMutation(op, collection.revision)
        if (payload.renamed !== undefined) applyRenamePayload(payload, payload.renamed)
        else applyPayload(payload)

        setDialog(null)
        setDialogError('')
        setToast(t(isGroup ? 'rename.done.group' : 'rename.done.list'))
        if (isGroup) {
          focusLater(['.ar-group[data-active="true"]', '[data-group-title="true"]'])
        } else {
          const listId = payload.renamed?.listId ?? dialog.listId
          focusLater([
            '[data-list-head="' + listId + '"]',
            '[data-group-title="true"]',
            '.ar-search__input',
          ])
        }
      } catch (error) {
        if (handleMutationError(error)) return
        if (error?.code === 'duplicate-group') setDialogError(t('rename.duplicateGroup'))
        else if (error?.code === 'duplicate-list') setDialogError(t('rename.duplicateList'))
        else setDialogError(t('rename.failed'))
      } finally {
        setBusy(false)
      }
    },
    [
      dialog,
      busy,
      collection,
      canMutate,
      applyRenamePayload,
      applyPayload,
      focusLater,
      handleMutationError,
      t,
    ],
  )

  const confirmDeleteStructure = useCallback(async () => {
    if (
      dialog === null ||
      (dialog.type !== 'delete-group' && dialog.type !== 'delete-list') ||
      busy ||
      collection === null ||
      !canMutate
    ) {
      return
    }

    const isGroup = dialog.type === 'delete-group'
    const name = isGroup ? dialog.name ?? '' : dialog.title ?? ''

    let neighbourGroupId = null
    let neighbourList = null
    if (isGroup) {
      const at = groups.findIndex((group) => group.id === dialog.groupId)
      const neighbour = at === -1 ? null : groups[at + 1] ?? groups[at - 1] ?? null
      neighbourGroupId = neighbour === null ? null : neighbour.id
    } else {
      const at = visibleLists.findIndex((list) => list.id === dialog.listId)
      neighbourList =
        at === -1 ? null : visibleLists[at + 1] ?? visibleLists[at - 1] ?? null
    }

    setBusy(true)
    setDialogError('')
    try {
      const payload = await requestMutation(
        isGroup
          ? { type: 'delete-group', groupId: dialog.groupId }
          : { type: 'delete-list', groupId: dialog.groupId, listId: dialog.listId },
        collection.revision,
      )

      applyPayload(payload, isGroup ? neighbourGroupId : undefined)
      setExpanded((current) => pruneExpanded(current, payload))
      const kept = pruneSelected(selected, payload)
      setSelected(kept)
      if (kept.size === 0) {
        setSelectionMode(false)
        setSummaryOpen(false)
      }
      setConfirmingId(null)
      setDialog(null)
      setDialogError('')
      setToast(t(isGroup ? 'delete.done.group' : 'delete.done.list', { name }))

      const selectors = []
      if (isGroup) {
        selectors.push('.ar-group[data-active="true"]', '[data-group-title="true"]')
      } else if (neighbourList !== null) {
        selectors.push('[data-list-head="' + neighbourList.id + '"]')
      }
      selectors.push('[data-group-title="true"]', '.ar-search__input')
      focusLater(selectors)
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
    groups,
    visibleLists,
    selected,
    applyPayload,
    focusLater,
    handleMutationError,
    t,
  ])

  const closeDialog = useCallback(() => {
    if (busy) return
    const trigger = dialogTriggerRef.current
    setDialog(null)
    setDialogError('')
    if (trigger !== null && trigger.isConnected) {
      requestAnimationFrame(() => trigger.focus())
    }
  }, [busy])

  const exitSelection = useCallback(
    (bookmarkId) => {
      if (busy) return
      setSelectionMode(false)
      setSelected(new Set())
      setSummaryOpen(false)
      setConfirmingId(null)

      const selectors = []
      if (typeof bookmarkId === 'string') {
        selectors.push('[data-focus-id="' + bookmarkId + '"]')
      }
      selectors.push('.ar-group[data-active="true"]', '[data-group-title="true"]')
      focusLater(selectors)
    },
    [busy, focusLater],
  )

  const toggleSelect = useCallback(
    (bookmarkId) => {
      if (busy || !canMutate) return
      const next = toggleId(selected, bookmarkId)
      // Unchecking the last card ends selection mode, so the grid returns to
      // browsing and the bar goes away with it.
      if (next.size === 0) {
        exitSelection(bookmarkId)
        return
      }
      setSelected(next)
      setSelectionMode(true)
      setConfirmingId(null)
    },
    [busy, selected, canMutate, exitSelection],
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
      if (next.size === 0) {
        exitSelection()
        return
      }
      setSelected(next)
    },
    [selected, exitSelection],
  )

  const clearSelection = useCallback(() => {
    exitSelection()
  }, [exitSelection])

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
      if (entryDialog !== null || importDialog !== null) return
      event.preventDefault()
      exitSelection()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectionMode, dialog, confirmingId, summaryOpen, entryDialog, importDialog, exitSelection])

  const header = h(PageHeader, {
    t,
    query,
    onQueryChange: changeQuery,
    busy,
    canMutate,
    onAddBookmark: openAddBookmark,
    onImport: pickImportFile,
  })
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

  const entryDialogNode =
    entryDialog === null
      ? null
      : h(AddBookmarkDialog, {
          t,
          groups,
          activeGroupId: activeGroup === null ? null : activeGroup.id,
          mode: entryDialog.mode,
          fixedGroupId: entryDialog.groupId,
          fixedListId: entryDialog.listId,
          busy,
          error: entryError,
          onCancel: closeEntryDialog,
          onConfirm: confirmAddBookmark,
        })

  const importDialogNode =
    importDialog === null
      ? null
      : h(ImportDialog, {
          t,
          fileName: importDialog.fileName,
          fileSize: importDialog.fileSize,
          summary: importDialog.summary,
          parseError: importDialog.parseError,
          busy,
          error: importError,
          onCancel: closeImportDialog,
          onPick: pickImportFile,
          onConfirm: confirmImport,
        })

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
  } else if (
    dialog !== null &&
    (dialog.type === 'rename-group' || dialog.type === 'rename-list')
  ) {
    const isGroup = dialog.type === 'rename-group'
    const group =
      collection === null
        ? null
        : collection.groups.find((candidate) => candidate.id === dialog.groupId) ?? null
    const list =
      group === null || isGroup
        ? null
        : group.lists.find((candidate) => candidate.id === dialog.listId) ?? null
    dialogNode = h(RenameDialog, {
      t,
      scope: isGroup ? 'group' : 'list',
      value: isGroup
        ? group?.name ?? dialog.name ?? ''
        : list?.title ?? dialog.title ?? '',
      busy,
      error: dialogError,
      onCancel: closeDialog,
      onConfirm: confirmRename,
      onDirty: () => setDialogError(''),
    })
  } else if (
    dialog !== null &&
    (dialog.type === 'delete-group' || dialog.type === 'delete-list')
  ) {
    const isGroup = dialog.type === 'delete-group'
    const group =
      collection === null
        ? null
        : collection.groups.find((candidate) => candidate.id === dialog.groupId) ?? null
    const orderedLists =
      group === null ? [] : listsByGroup.get(group.id) ?? group.lists
    const list =
      group === null || isGroup
        ? null
        : orderedLists.find((candidate) => candidate.id === dialog.listId) ?? null

    let rows = []
    let more = ''
    if (isGroup) {
      rows = orderedLists.slice(0, 4).map((candidate) => ({
        path: t('count.bookmarks', { n: candidate.count }),
        title: candidate.title,
      }))
      if (orderedLists.length > rows.length) {
        more = t('delete.moreItems', { n: orderedLists.length - rows.length })
      }
    } else if (list !== null) {
      const orderedBookmarks = orderListBookmarks(list, order).bookmarks
      rows = orderedBookmarks.slice(0, 4).map((bookmark) => ({
        path: '',
        title: bookmark.title,
      }))
      if (orderedBookmarks.length > rows.length) {
        more = t('delete.moreItems', { n: orderedBookmarks.length - rows.length })
      }
    }

    dialogNode = h(StructureDeleteDialog, {
      t,
      scope: isGroup ? 'group' : 'list',
      name: isGroup ? group?.name ?? dialog.name ?? '' : list?.title ?? dialog.title ?? '',
      lists: orderedLists.length,
      bookmarks: isGroup ? group?.count ?? 0 : list?.count ?? 0,
      rows,
      more,
      busy,
      error: dialogError,
      onCancel: closeDialog,
      onConfirm: confirmDeleteStructure,
    })
  }

  const fileInput = h('input', {
    key: 'import-file',
    ref: fileInputRef,
    type: 'file',
    accept: 'application/json,.json',
    style: { display: 'none' },
    onChange: (event) => {
      const file = event.target.files !== null && event.target.files.length > 0
        ? event.target.files[0]
        : null
      event.target.value = ''
      if (file !== null) void handleImportFile(file)
    },
  })

  const overlays = [fileInput, dialogNode, entryDialogNode, importDialogNode]
  const toastNode =
    toast === null ? null : h('div', { className: 'ar-toast', role: 'status' }, toast)
  const dialogOpen = dialog !== null || entryDialog !== null || importDialog !== null

  if (status === 'loading') {
    return h(
      'div',
      { className: 'ar-root', 'data-busy': busy ? 'true' : 'false' },
      h('style', { key: 'styles' }, CSS),
      header,
      h('div', { className: 'ar-state' }, t('status.loading')),
      ...overlays,
    )
  }

  if (status === 'error') {
    return h(
      'div',
      { className: 'ar-root', 'data-busy': busy ? 'true' : 'false' },
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
      toastNode,
      ...overlays,
    )
  }

  if (collection !== null && groups.length === 0) {
    return h(
      'div',
      {
        className: 'ar-root',
        'data-dialog-open': dialogOpen ? 'true' : 'false',
        'data-busy': busy ? 'true' : 'false',
      },
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
      toastNode,
      ...overlays,
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
    dragDisabled:
      confirmingId !== null || dialog !== null || entryDialog !== null || importDialog !== null,
    onSelect: selectGroup,
    onReorder: reorderGroups,
  })

  const mainChildren = []

  if (activeGroup !== null) {
    const showExpand = queryText === '' && activeLists.length > 0
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
        showExpand || canMutate
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
              canMutate
                ? h(MoreMenu, {
                    label: t('menu.groupAria', { name: activeGroup.name }),
                    disabled: busy,
                    items: [
                      {
                        id: 'rename',
                        label: t('menu.rename'),
                        icon: h(EditGlyph, { size: 14 }),
                        onSelect: (trigger) =>
                          openStructureDialog('rename-group', activeGroup, null, trigger),
                      },
                      {
                        id: 'delete',
                        label: t('menu.deleteGroup'),
                        icon: h(TrashGlyph, { size: 14 }),
                        danger: true,
                        onSelect: (trigger) =>
                          openStructureDialog('delete-group', activeGroup, null, trigger),
                      },
                    ],
                  })
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
              confirmingId !== null ||
              entryDialog !== null ||
              importDialog !== null,
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
              onAdd: openAddToList,
              onRename: (candidate, trigger) =>
                openStructureDialog('rename-list', activeGroup, candidate, trigger),
              onDelete: (candidate, trigger) =>
                openStructureDialog('delete-list', activeGroup, candidate, trigger),
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

  const dock = selectionBarVisible
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

  return h(
    'div',
    {
      className: 'ar-root',
      style: { '--ar-rail-width': `${railWidth}px` },
      'data-select-mode': selectionMode ? 'true' : 'false',
      'data-bar-visible': selectionBarVisible ? 'true' : 'false',
      'data-dialog-open': dialogOpen ? 'true' : 'false',
      'data-busy': busy ? 'true' : 'false',
    },
    h('style', { key: 'styles' }, CSS),
    header,
    h(
      'div',
      { className: 'ar-body', ref: bodyRef },
      side,
      h(RailResizer, {
        t,
        width: railWidth,
        max: railMax,
        onChange: changeRailWidth,
        onCommit: commitRailWidth,
      }),
      main,
    ),
    dock,
    ...overlays,
    toastNode,
  )
}

module.exports = { Panel }
