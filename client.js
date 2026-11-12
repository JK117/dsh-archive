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
/** The three Host calls the panel makes. All fail by throwing. */
const { LIBRARY_URL, MUTATE_URL, OPEN_URL } = require('./constants.js')

function asLibrary(payload) {
  if (!Array.isArray(payload?.groups)) throw new Error('invalid-library')
  return payload
}

async function fetchLibrary(signal) {
  const response = await fetch(LIBRARY_URL, {
    signal,
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return asLibrary(await response.json())
}

async function openBookmark(url) {
  const response = await fetch(OPEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
}

/**
 * One delete / move operation. On a 409 stale conflict the Host returns the
 * latest library alongside the error, so the caller can refresh in place.
 */
async function mutateLibrary(op, revision) {
  const response = await fetch(MUTATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ revision, op }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const code = typeof payload?.error === 'string' ? payload.error : 'mutation-failed'
    const error = new Error(code)
    error.code = code
    if (code === 'stale-library' && Array.isArray(payload?.groups)) {
      error.library = payload
    }
    throw error
  }

  return asLibrary(payload)
}

module.exports = { fetchLibrary, openBookmark, mutateLibrary }
      },
"./bookmarks.js": function (module, exports, require) {
/** Presentational pieces of the library: group rows, list sections, cards. */
const React = require('react')
const h = React.createElement
const { useState, useEffect, useRef } = React
const { Chevron, CheckGlyph, TrashGlyph, PlusGlyph } = require('./glyphs.js')
const { Sortable } = require('./sortable.js')

/** Keep in sync with the .16s exit animation in styles.js; 20ms covers a frame. */
const CONFIRM_EXIT_MS = 180

/** Mirrors the CSS reduced-motion query so cancel can skip the exit delay too. */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia !== undefined &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
  )
}

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
 * One bookmark. The anchor is a transparent layer over the whole card, so the
 * native link behavior (context menu, modified click, hover URL) is kept while
 * the checkbox and trash can be real buttons beside it, not inside it.
 */
function BookmarkCard({
  t,
  bookmark,
  selected,
  selectionMode,
  busy,
  canMutate,
  confirming,
  deleteBusy,
  onOpen,
  onToggle,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  const cardRef = useRef(null)
  const trashRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const wasConfirming = useRef(false)
  const [leaving, setLeaving] = useState(false)
  /* A pointer uncheck hides the box at once, even while the pointer still
     rests on the card; leaving and hovering again brings it back. */
  const [suppressCheck, setSuppressCheck] = useState(false)

  useEffect(() => {
    if (wasConfirming.current && !confirming && trashRef.current !== null) {
      const frame = requestAnimationFrame(() => {
        if (trashRef.current !== null) trashRef.current.focus()
      })
      wasConfirming.current = confirming
      return () => cancelAnimationFrame(frame)
    }
    wasConfirming.current = confirming
    return undefined
  }, [confirming])

  // A cancel click keeps the overlay mounted for its reverse animation, then
  // tells the panel to clear the confirming card.
  useEffect(() => {
    if (!leaving) return undefined
    const timer = setTimeout(() => onCancelDelete(bookmark.id), CONFIRM_EXIT_MS)
    return () => clearTimeout(timer)
  }, [leaving, onCancelDelete, bookmark.id])

  useEffect(() => {
    if (!confirming) setLeaving(false)
  }, [confirming])

  useEffect(() => {
    if (confirming && cancelRef.current !== null) cancelRef.current.focus()
  }, [confirming])

  useEffect(() => {
    if (!confirming) return undefined
    const onPointerDown = (event) => {
      if (deleteBusy) return
      if (cardRef.current !== null && !cardRef.current.contains(event.target)) {
        onCancelDelete(bookmark.id)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [confirming, deleteBusy, onCancelDelete])

  useEffect(() => {
    if (!confirming) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (!deleteBusy) onCancelDelete(bookmark.id)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming, deleteBusy, onCancelDelete])

  const requestCancel = () => {
    if (leaving || deleteBusy) return
    if (prefersReducedMotion()) {
      onCancelDelete(bookmark.id)
      return
    }
    setLeaving(true)
  }

  const onConfirmKeyDown = (event) => {
    if (event.key !== 'Tab') return
    const cancel = cancelRef.current
    const confirm = confirmRef.current
    if (cancel === null || confirm === null) return
    // Delete now comes first in the row, so the Tab loop runs delete -> cancel
    // and wraps from cancel back to delete.
    if (event.shiftKey && document.activeElement === confirm) {
      event.preventDefault()
      cancel.focus()
    } else if (!event.shiftKey && document.activeElement === cancel) {
      event.preventDefault()
      confirm.focus()
    }
  }

  const toggleSelection = (event) => {
    if (selected && event.detail > 0) setSuppressCheck(true)
    onToggle(bookmark.id)
  }

  const confirmLabelId = 'ar-confirm-' + bookmark.id

  return h(
    'div',
    {
      className: 'ar-card',
      ref: cardRef,
      'data-sort-id': bookmark.id,
      'data-selected': selected ? 'true' : 'false',
      'data-selecting': selectionMode ? 'true' : 'false',
      'data-confirming': confirming ? 'true' : 'false',
      'data-suppress-check': suppressCheck && !selected ? 'true' : 'false',
      onMouseLeave: () => setSuppressCheck(false),
    },
    h('a', {
      className: 'ar-card__link',
      href: bookmark.url,
      target: '_blank',
      rel: 'noreferrer',
      title: bookmark.title + '\n' + bookmark.url,
      'aria-label': bookmark.title,
      'data-focus-id': bookmark.id,
      draggable: false,
      tabIndex: selectionMode || confirming ? -1 : undefined,
      onClick: (event) => {
        if (selectionMode) {
          event.preventDefault()
          toggleSelection(event)
          return
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onOpen(bookmark.url)
      },
    }),
    h(
      'span',
      { className: 'ar-card__lead' },
      h(Favicon, { bookmark }),
      canMutate === true ? h(
        'button',
        {
          type: 'button',
          className: 'ar-card__check',
          role: 'checkbox',
          'aria-checked': selected ? 'true' : 'false',
          'aria-label': t('select.cardAria', { title: bookmark.title }),
          'aria-hidden': selectionMode ? undefined : 'true',
          'data-checked': selected ? 'true' : 'false',
          'data-no-drag': '1',
          tabIndex: selectionMode && !confirming ? 0 : -1,
          disabled: busy === true,
          onClick: (event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleSelection(event)
          },
        },
        selected ? h(CheckGlyph, { size: 12 }) : null,
      ) : null,
    ),
    h('span', { className: 'ar-card__title', 'aria-hidden': 'true' }, bookmark.title),
    canMutate === true && !selectionMode && !confirming
      ? h(
          'button',
          {
            type: 'button',
            className: 'ar-card__trash',
            ref: trashRef,
            'aria-label': t('delete.cardAria', { title: bookmark.title }),
            title: t('delete.cardAria', { title: bookmark.title }),
            'data-no-drag': '1',
            disabled: busy === true,
            onClick: (event) => {
              event.preventDefault()
              event.stopPropagation()
              onRequestDelete(bookmark.id)
            },
          },
          h(TrashGlyph, { size: 14 }),
        )
      : null,
    confirming
      ? h(
          'div',
          {
            className: 'ar-card__confirm',
            role: 'dialog',
            'aria-labelledby': confirmLabelId,
            'data-no-drag': '1',
            'data-leaving': leaving ? 'true' : 'false',
            onClick: (event) => event.stopPropagation(),
            onKeyDown: onConfirmKeyDown,
          },
          h('span', { className: 'ar-card__confirm-text', id: confirmLabelId }, t('delete.cardTitle')),
          h(
            'div',
            { className: 'ar-card__confirm-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ar-card__confirm-btn ar-card__confirm-btn--danger',
                ref: confirmRef,
                disabled: deleteBusy === true,
                onClick: (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (leaving) return
                  onConfirmDelete()
                },
              },
              deleteBusy === true ? t('delete.busy') : t('delete.cardConfirm'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ar-card__confirm-btn',
                ref: cancelRef,
                disabled: deleteBusy === true,
                onClick: (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  requestCancel()
                },
              },
              t('cancel'),
            ),
          ),
        )
      : null,
  )
}

/**
 * A second-level folder: its header toggles a grid of bookmark cards. The
 * colour comes from the surrounding view's `data-tone`, so every list of a
 * group shares that group's hue at a softer saturation.
 */
function ListSection({
  t,
  list,
  open,
  collapsible,
  sortable,
  selectionMode,
  selected,
  busy,
  canMutate,
  confirmingId,
  deleteBusy,
  onToggle,
  onAdd,
  onOpen,
  onToggleSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onReorderBookmarks,
}) {
  const inner = [
    h('span', { key: 'title', className: 'ar-sec__title' }, list.title),
    h(Chevron, { key: 'chev', open }),
    h('span', { key: 'count', className: 'ar-sec__count' }, list.count),
  ]
  const sortAttrs = {
    'data-sort-id': list.id,
    'data-list-head': list.id,
  }
  const head = collapsible
    ? h(
        'button',
        {
          type: 'button',
          className: 'ar-sec__head',
          'aria-expanded': open ? 'true' : 'false',
          disabled: busy === true,
          ...sortAttrs,
          onClick: onToggle,
        },
        inner,
      )
    : h(
        'div',
        { className: 'ar-sec__head', 'data-static': 'true', tabIndex: -1, ...sortAttrs },
        inner,
      )

  const addLabel = t('add.toListAria', { list: list.title })
  const addButton =
    canMutate === true
      ? h(
          'button',
          {
            type: 'button',
            className: 'ar-sec__add',
            title: addLabel,
            'aria-label': addLabel,
            'data-list-add': list.id,
            'data-no-drag': '1',
            disabled: busy === true,
            onClick: (event) => {
              event.preventDefault()
              event.stopPropagation()
              onAdd(list.id)
            },
          },
          h(PlusGlyph, { size: 14 }),
        )
      : null

  const bookmarkIds = list.bookmarks.map((bookmark) => bookmark.id)
  const gridDisabled =
    !sortable || selectionMode === true || busy === true || bookmarkIds.length < 2

  return h(
    'section',
    {
      className: 'ar-sec',
      'data-open': open ? 'true' : 'false',
      'data-section-id': list.id,
      'aria-label': list.title,
    },
    h(
      'div',
      { className: 'ar-sec__headbar', 'data-add': canMutate === true ? 'true' : 'false' },
      head,
      addButton,
    ),
    h(
      'div',
      { className: 'ar-sec__body' },
      h(
        'div',
        { className: 'ar-sec__inner' },
        list.bookmarks.length === 0
          ? h('div', { className: 'ar-sec__empty' }, t('empty.list'))
          : h(
              Sortable,
              {
                className: 'ar-grid',
                ids: bookmarkIds,
                axis: 'grid',
                disabled: gridDisabled,
                onReorder: (from, to) =>
                  onReorderBookmarks(list.id, bookmarkIds, from, to),
              },
              list.bookmarks.map((bookmark) =>
                h(BookmarkCard, {
                  key: bookmark.id,
                  t,
                  bookmark,
                  selected: selected.has(bookmark.id),
                  selectionMode,
                  busy,
                  canMutate,
                  confirming: confirmingId === bookmark.id,
                  deleteBusy,
                  onOpen,
                  onToggle: onToggleSelect,
                  onRequestDelete,
                  onCancelDelete,
                  onConfirmDelete,
                }),
              ),
            ),
      ),
    ),
  )
}

function GroupRow({
  t,
  group,
  tone,
  count,
  selectedCount,
  active,
  dim,
  disabled,
  onClick,
}) {
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
      disabled: disabled === true,
      onClick,
    },
    h('span', { className: 'ar-group__name' }, group.name),
    selectedCount > 0
      ? h(
          'span',
          {
            className: 'ar-group__sel',
            title: t('select.badge', { n: selectedCount }),
            'aria-label': t('select.badge', { n: selectedCount }),
          },
          selectedCount,
        )
      : null,
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
const MUTATE_URL = '/dsh-archive/mutate'

/** Selected group + collapsed lists. Keyed by the Host-provided ids. */
const STATE_KEY = 'dsh-archive:state:v2'

/**
 * Manual order per level. v3 belongs to the content-derived ids; the old
 * positional `v2` order is intentionally not migrated.
 */
const ORDER_KEY = 'dsh-archive:order:v3'

/** Touch only: a short hold separates a drag from a scroll gesture. */
const HOLD_MS = 280

/** Mouse / pen must travel this far before the source lifts and siblings fill. */
const DRAG_TRIGGER_DISTANCE = 24

/** Touch movement before the hold completes cancels the drag, so scrolling works. */
const TOUCH_SCROLL_TOLERANCE = 8

/** Mirrors the Host's MAX_DATA_BYTES; larger imports are rejected before reading. */
const MAX_IMPORT_BYTES = 8 * 1024 * 1024

/** Candy hues cycled by the left rail and the right column's group title. */
const TONE_COUNT = 8

module.exports = {
  NS,
  PANEL_ID,
  LIBRARY_URL,
  OPEN_URL,
  MUTATE_URL,
  STATE_KEY,
  ORDER_KEY,
  HOLD_MS,
  DRAG_TRIGGER_DISTANCE,
  TOUCH_SCROLL_TOLERANCE,
  MAX_IMPORT_BYTES,
  TONE_COUNT,
}
      },
"./dialogs.js": function (module, exports, require) {
/**
 * The three floating pieces of the bulk flow: a focus-trapped modal shell, the
 * batch-delete confirmation, the two-dropdown move picker, and the selection
 * summary that makes cross-group selections inspectable.
 */
const React = require('react')
const h = React.createElement
const { useEffect, useRef, useState } = React
const { CloseGlyph } = require('./glyphs.js')
const { targetStats } = require('./selection.js')

function focusablesIn(panel) {
  if (panel === null) return []
  return Array.from(
    panel.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]'),
  ).filter((element) => element.offsetParent !== null)
}

/** A centered modal with a scrim, focus trap, Escape, and outside-click. */
function Modal({ title, children, footer, onCancel, busy, initialFocusRef, width, tone }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const preferred =
      (initialFocusRef !== undefined && initialFocusRef.current !== null
        ? initialFocusRef.current
        : null) ?? focusablesIn(panelRef.current)[0]
    if (preferred !== null && typeof preferred.focus === 'function') preferred.focus()
  }, [initialFocusRef])

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (busy !== true) onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const nodes = focusablesIn(panelRef.current)
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return h(
    'div',
    {
      className: 'ar-modal',
      onKeyDown,
      onMouseDown: (event) => {
        if (event.target === event.currentTarget && busy !== true) onCancel()
      },
    },
    h(
      'div',
      {
        className: 'ar-modal__panel',
        'data-tone': tone,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title,
        ref: panelRef,
        style: width === undefined ? undefined : { width },
      },
      h('div', { className: 'ar-modal__title' }, title),
      h('div', { className: 'ar-modal__body' }, children),
      footer === undefined ? null : h('div', { className: 'ar-modal__footer' }, footer),
    ),
  )
}

/** Delete N selected bookmarks, after one explicit confirmation. */
function BatchDeleteDialog({ t, entries, busy, error, onCancel, onConfirm }) {
  const cancelRef = useRef(null)
  const title = t('delete.batchTitle', { n: entries.length })
  const visible = entries.slice(0, 4)
  const remaining = entries.length - visible.length

  return h(
    Modal,
    {
      title,
      tone: 'danger',
      onCancel,
      busy,
      initialFocusRef: cancelRef,
      footer: h(
        'div',
        { className: 'ar-modal__actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn',
            ref: cancelRef,
            disabled: busy === true,
            onClick: onCancel,
          },
          t('cancel'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn ar-btn--danger',
            disabled: busy === true,
            onClick: onConfirm,
          },
          busy === true ? t('delete.busy') : t('delete.batchConfirm'),
        ),
      ),
    },
    h('div', { className: 'ar-modal__note' }, t('delete.irreversible')),
    h(
      'ul',
      { className: 'ar-pick-list' },
      visible.map((entry) =>
        h(
          'li',
          { key: entry.bookmark.id, className: 'ar-pick-list__row' },
          h('span', { className: 'ar-pick-list__path' }, entry.group.name + ' / ' + entry.list.title),
          h('span', { className: 'ar-pick-list__title', title: entry.bookmark.title }, entry.bookmark.title),
        ),
      ),
      remaining > 0
        ? h('li', { className: 'ar-pick-list__row ar-pick-list__more' }, t('delete.moreItems', { n: remaining }))
        : null,
    ),
    error === '' || error === null || error === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, error),
  )
}

function groupOptionLabel(t, group, selected) {
  const base = group.name + ' · ' + t('count.bookmarks', { n: group.count })
  return selected > 0 ? base + ' ' + t('move.optionSelected', { k: selected }) : base
}

function listOptionLabel(t, list, selected) {
  const base = list.title + ' · ' + t('count.bookmarks', { n: list.count })
  return selected > 0 ? base + ' ' + t('move.optionSelected', { k: selected }) : base
}

/**
 * Move the current selection into one existing list. Two native selects keep
 * the flow small and accessible; empty lists are valid targets, empty groups
 * (no lists) are not.
 */
function MoveDialog({ t, groups, activeGroupId, entries, busy, error, onCancel, onConfirm }) {
  const initialGroup =
    groups.some((group) => group.id === activeGroupId) && groups.length > 0
      ? activeGroupId
      : groups[0]?.id ?? ''
  const [groupId, setGroupId] = useState(initialGroup)
  const [listId, setListId] = useState('')
  const groupSelectRef = useRef(null)

  const group = groups.find((candidate) => candidate.id === groupId) ?? null
  const list = group === null ? null : group.lists.find((candidate) => candidate.id === listId) ?? null

  const stats = list === null ? { total: entries.length, inTarget: 0, moving: entries.length } : targetStats(entries, list.id)
  const valid = list !== null && stats.moving > 0

  const hint = []
  if (list === null) {
    hint.push(t('move.chooseList'))
  } else if (stats.moving === 0) {
    hint.push(t('move.same'))
  } else {
    hint.push(t('move.preview', { group: group.name, list: list.title }))
    if (stats.inTarget > 0) hint.push(t('move.skip', { k: stats.inTarget }))
    if (list.count === 0) hint.push(t('move.emptyTarget'))
  }

  return h(
    Modal,
    {
      title: t('move.title', { n: entries.length }),
      onCancel,
      busy,
      initialFocusRef: groupSelectRef,
      footer: h(
        'div',
        { className: 'ar-modal__actions' },
        h(
          'button',
          { type: 'button', className: 'ar-btn', disabled: busy === true, onClick: onCancel },
          t('cancel'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn ar-btn--primary',
            disabled: busy === true || !valid,
            onClick: () => onConfirm({ groupId, listId }),
          },
          busy === true ? t('move.busy') : t('move.confirm'),
        ),
      ),
    },
    h(
      'label',
      { className: 'ar-form__field' },
      h('span', { className: 'ar-form__label' }, t('move.group')),
      h(
        'select',
        {
          className: 'ar-form__select',
          ref: groupSelectRef,
          value: groupId,
          disabled: busy === true || groups.length === 0,
          onChange: (event) => {
            setGroupId(event.target.value)
            setListId('')
          },
        },
        groups.length === 0
          ? h('option', { value: '' }, t('move.chooseGroup'))
          : groups.map((candidate) =>
              h(
                'option',
                { key: candidate.id, value: candidate.id },
                groupOptionLabel(
                  t,
                  candidate,
                  entries.filter((entry) => entry.group.id === candidate.id).length,
                ),
              ),
            ),
      ),
    ),
    h(
      'label',
      { className: 'ar-form__field' },
      h('span', { className: 'ar-form__label' }, t('move.list')),
      h(
        'select',
        {
          className: 'ar-form__select',
          value: listId,
          disabled: busy === true || group === null || group.lists.length === 0,
          onChange: (event) => setListId(event.target.value),
        },
        h(
          'option',
          { value: '' },
          group !== null && group.lists.length === 0 ? t('move.noLists') : t('move.chooseList'),
        ),
        group === null
          ? null
          : group.lists.map((candidate) =>
              h(
                'option',
                { key: candidate.id, value: candidate.id },
                listOptionLabel(
                  t,
                  candidate,
                  entries.filter((entry) => entry.list.id === candidate.id).length,
                ),
              ),
            ),
      ),
    ),
    h(
      'div',
      { className: 'ar-modal__hint' },
      hint.map((line, index) => h('div', { key: String(index) }, line)),
    ),
    error === '' || error === null || error === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, error),
  )
}

/**
 * A non-modal popover that lists every selected bookmark, grouped by its
 * library location. Needed because cross-group selections are not all visible
 * in the current column at once.
 */
function SelectionSummary({ t, entries, onRemove, onClear, onJump, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (panelRef.current !== null) panelRef.current.focus()
  }, [])

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target
      if (panelRef.current !== null && panelRef.current.contains(target)) return
      if (target instanceof Element && target.closest('.ar-bar__count') !== null) return
      onClose()
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const groups = []
  for (const entry of entries) {
    let group = groups.find((candidate) => candidate.id === entry.group.id)
    if (group === undefined) {
      group = { id: entry.group.id, name: entry.group.name, lists: [] }
      groups.push(group)
    }
    let list = group.lists.find((candidate) => candidate.id === entry.list.id)
    if (list === undefined) {
      list = { id: entry.list.id, title: entry.list.title, items: [] }
      group.lists.push(list)
    }
    list.items.push(entry)
  }

  return h(
    'div',
    {
      className: 'ar-summary',
      role: 'dialog',
      'aria-label': t('select.summary'),
      tabIndex: -1,
      ref: panelRef,
    },
    h(
      'div',
      { className: 'ar-summary__head' },
      h('span', { className: 'ar-summary__count' }, t('select.count', { n: entries.length })),
      h(
        'button',
        { type: 'button', className: 'ar-summary__clear', onClick: onClear },
        t('select.clear'),
      ),
    ),
    h(
      'div',
      { className: 'ar-summary__body' },
      groups.map((group) =>
        h(
          'div',
          { key: group.id, className: 'ar-summary__group' },
          h(
            'button',
            {
              type: 'button',
              className: 'ar-summary__group-head',
              onClick: () => onJump(group.id),
            },
            group.name,
            h(
              'span',
              { className: 'ar-summary__group-count' },
              t('select.badge', {
                n: group.lists.reduce((total, list) => total + list.items.length, 0),
              }),
            ),
          ),
          group.lists.map((list) =>
            h(
              'div',
              { key: list.id, className: 'ar-summary__list' },
              h('div', { className: 'ar-summary__list-head' }, list.title),
              list.items.map((entry) =>
                h(
                  'div',
                  { key: entry.bookmark.id, className: 'ar-summary__item' },
                  h(
                    'span',
                    { className: 'ar-summary__item-title', title: entry.bookmark.title },
                    entry.bookmark.title,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ar-summary__remove',
                      'aria-label': t('select.remove', { title: entry.bookmark.title }),
                      title: t('select.remove', { title: entry.bookmark.title }),
                      onClick: () => onRemove(entry.bookmark.id),
                    },
                    h(CloseGlyph, { size: 12 }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'ar-summary__foot' },
      h('button', { type: 'button', className: 'ar-btn', onClick: onClose }, t('cancel')),
    ),
  )
}

/**
 * Turns what a person typed into an absolute http(s) URL. A bare host gets
 * `https://`; any other scheme (`javascript:`, `mailto:`, `file:` …) is
 * rejected. Host:port forms such as `example.com:8080` stay valid.
 */
function normalizeLink(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw === '') return ''

  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):/i)
  if (scheme !== null && !/^https?$/i.test(scheme[1])) {
    const hostPort = /^[^/?#]+:\d+(\/|$)/.test(raw)
    if (!hostPort) return ''
  }

  let candidate = raw
  if (!/^https?:\/\//i.test(raw)) {
    candidate = raw.startsWith('//') ? 'https:' + raw : 'https://' + raw
  }

  try {
    const url = new URL(candidate)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.hostname === '') {
      return ''
    }
    return url.toString()
  } catch {
    return ''
  }
}

function firstListId(group) {
  return group === null || group === undefined ? '__new__' : group.lists[0]?.id ?? '__new__'
}

/**
 * One bookmark entry. In `page` mode the person picks an existing group / list
 * or names new ones; in `list` mode the destination is the list whose + button
 * opened the dialog and only the link itself is asked for.
 */
function AddBookmarkDialog({
  t,
  groups,
  activeGroupId,
  mode,
  fixedGroupId,
  fixedListId,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  const fixedGroup = groups.find((group) => group.id === fixedGroupId) ?? null
  const fixedList =
    fixedGroup === null
      ? null
      : fixedGroup.lists.find((list) => list.id === fixedListId) ?? null

  const defaultGroupId =
    groups.some((group) => group.id === activeGroupId)
      ? activeGroupId
      : groups[0]?.id ?? '__new__'
  const defaultGroup = groups.find((group) => group.id === defaultGroupId) ?? null

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [groupChoice, setGroupChoice] = useState(defaultGroupId)
  const [listChoice, setListChoice] = useState(firstListId(defaultGroup))
  const [newGroupName, setNewGroupName] = useState('')
  const [newListName, setNewListName] = useState('')
  const [localError, setLocalError] = useState('')

  const urlRef = useRef(null)
  const groupNameRef = useRef(null)
  const listNameRef = useRef(null)

  const group = groups.find((candidate) => candidate.id === groupChoice) ?? null
  const newGroup = mode === 'page' && groupChoice === '__new__'
  const newList =
    mode === 'page' && (newGroup || group === null || listChoice === '__new__')

  const submit = () => {
    if (busy === true) return
    const link = normalizeLink(url)
    if (link === '') {
      setLocalError(t('add.invalidUrl'))
      if (urlRef.current !== null) urlRef.current.focus()
      return
    }

    const bookmark = { url: link, title: title.trim() }
    let target

    if (mode === 'list') {
      if (fixedGroup === null || fixedList === null) {
        setLocalError(t('add.failed'))
        return
      }
      target = { groupId: fixedGroup.id, listId: fixedList.id }
    } else if (newGroup) {
      const name = newGroupName.trim()
      if (name === '') {
        setLocalError(t('add.missingGroup'))
        if (groupNameRef.current !== null) groupNameRef.current.focus()
        return
      }
      const listTitle = newListName.trim()
      if (listTitle === '') {
        setLocalError(t('add.missingList'))
        if (listNameRef.current !== null) listNameRef.current.focus()
        return
      }
      target = { groupName: name, listTitle }
    } else if (newList) {
      if (group === null) {
        setLocalError(t('add.failed'))
        return
      }
      const listTitle = newListName.trim()
      if (listTitle === '') {
        setLocalError(t('add.missingList'))
        if (listNameRef.current !== null) listNameRef.current.focus()
        return
      }
      target = { groupId: group.id, listTitle }
    } else {
      target = { groupId: group.id, listId: listChoice }
    }

    setLocalError('')
    onConfirm({ bookmark, target })
  }

  const onEnter = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

  const fields = []

  fields.push(
    h(
      'label',
      { className: 'ar-form__field', key: 'url' },
      h('span', { className: 'ar-form__label' }, t('add.url')),
      h('input', {
        className: 'ar-form__input',
        ref: urlRef,
        type: 'url',
        value: url,
        placeholder: t('add.urlPlaceholder'),
        spellCheck: false,
        disabled: busy === true,
        onChange: (event) => setUrl(event.target.value),
        onKeyDown: onEnter,
      }),
    ),
  )

  fields.push(
    h(
      'label',
      { className: 'ar-form__field', key: 'title' },
      h('span', { className: 'ar-form__label' }, t('add.titleLabel')),
      h('input', {
        className: 'ar-form__input',
        type: 'text',
        value: title,
        placeholder: t('add.titlePlaceholder'),
        disabled: busy === true,
        onChange: (event) => setTitle(event.target.value),
        onKeyDown: onEnter,
      }),
    ),
  )

  if (mode === 'list') {
    fields.push(
      h(
        'div',
        { className: 'ar-form__target', key: 'target' },
        h('span', { className: 'ar-form__label' }, t('add.target')),
        h(
          'span',
          { className: 'ar-form__target-value' },
          fixedGroup === null || fixedList === null
            ? t('add.failed')
            : fixedGroup.name + ' / ' + fixedList.title,
        ),
      ),
    )
  } else {
    fields.push(
      h(
        'label',
        { className: 'ar-form__field', key: 'group' },
        h('span', { className: 'ar-form__label' }, t('add.group')),
        h(
          'select',
          {
            className: 'ar-form__select',
            value: groupChoice,
            disabled: busy === true,
            onChange: (event) => {
              const value = event.target.value
              setGroupChoice(value)
              setNewGroupName('')
              setNewListName('')
              const next = groups.find((candidate) => candidate.id === value) ?? null
              setListChoice(firstListId(next))
            },
          },
          groups.length === 0
            ? h('option', { value: '__new__' }, t('add.newGroup'))
            : groups.map((candidate) =>
                h('option', { key: candidate.id, value: candidate.id }, candidate.name),
              ),
          groups.length === 0
            ? null
            : h('option', { value: '__new__' }, t('add.newGroup')),
        ),
      ),
    )

    if (newGroup) {
      fields.push(
        h(
          'label',
          { className: 'ar-form__field', key: 'groupName' },
          h('span', { className: 'ar-form__label' }, t('add.groupName')),
          h('input', {
            className: 'ar-form__input',
            ref: groupNameRef,
            type: 'text',
            value: newGroupName,
            placeholder: t('add.groupPlaceholder'),
            disabled: busy === true,
            onChange: (event) => setNewGroupName(event.target.value),
            onKeyDown: onEnter,
          }),
        ),
      )
    }

    if (newGroup || group === null || group.lists.length === 0) {
      fields.push(
        h(
          'label',
          { className: 'ar-form__field', key: 'newList' },
          h('span', { className: 'ar-form__label' }, t('add.listName')),
          h('input', {
            className: 'ar-form__input',
            ref: listNameRef,
            type: 'text',
            value: newListName,
            placeholder: t('add.listPlaceholder'),
            disabled: busy === true,
            onChange: (event) => setNewListName(event.target.value),
            onKeyDown: onEnter,
          }),
        ),
      )
    } else {
      fields.push(
        h(
          'label',
          { className: 'ar-form__field', key: 'list' },
          h('span', { className: 'ar-form__label' }, t('add.list')),
          h(
            'select',
            {
              className: 'ar-form__select',
              value: listChoice,
              disabled: busy === true,
              onChange: (event) => {
                setListChoice(event.target.value)
                setNewListName('')
              },
            },
            group.lists.map((candidate) =>
              h('option', { key: candidate.id, value: candidate.id }, candidate.title),
            ),
            h('option', { value: '__new__' }, t('add.newList')),
          ),
        ),
      )

      if (listChoice === '__new__') {
        fields.push(
          h(
            'label',
            { className: 'ar-form__field', key: 'listName' },
            h('span', { className: 'ar-form__label' }, t('add.listName')),
            h('input', {
              className: 'ar-form__input',
              ref: listNameRef,
              type: 'text',
              value: newListName,
              placeholder: t('add.listPlaceholder'),
              disabled: busy === true,
              onChange: (event) => setNewListName(event.target.value),
              onKeyDown: onEnter,
            }),
          ),
        )
      }
    }
  }

  const message = localError !== '' ? localError : error

  return h(
    Modal,
    {
      title: t('add.title'),
      onCancel,
      busy,
      initialFocusRef: urlRef,
      width: 'min(440px, 100%)',
      footer: h(
        'div',
        { className: 'ar-modal__actions' },
        h(
          'button',
          { type: 'button', className: 'ar-btn', disabled: busy === true, onClick: onCancel },
          t('cancel'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn ar-btn--primary',
            disabled: busy === true,
            onClick: submit,
          },
          busy === true ? t('add.busy') : t('add.confirm'),
        ),
      ),
    },
    fields,
    message === '' || message === null || message === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, message),
  )
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/**
 * Confirms one JSON file import. The file has already been read and parsed by
 * the panel; this dialog explains the merge rule and shows the rough shape so an
 * accidental file is caught before it reaches the Host.
 */
function ImportDialog({
  t,
  fileName,
  fileSize,
  summary,
  parseError,
  busy,
  error,
  onCancel,
  onPick,
  onConfirm,
}) {
  const cancelRef = useRef(null)
  const size = formatBytes(fileSize)
  const meta = []
  if (size !== '') meta.push(size)
  if (summary !== null && summary !== undefined) {
    meta.push(
      t('import.summary', {
        groups: summary.groups,
        lists: summary.lists,
        bookmarks: summary.bookmarks,
      }),
    )
  }

  const canImport = busy !== true && summary !== null && summary !== undefined && parseError === ''

  return h(
    Modal,
    {
      title: t('import.title'),
      onCancel,
      busy,
      initialFocusRef: cancelRef,
      width: 'min(460px, 100%)',
      footer: h(
        'div',
        { className: 'ar-modal__actions' },
        h(
          'button',
          { type: 'button', className: 'ar-btn', disabled: busy === true, onClick: onPick },
          t('import.pick'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn',
            ref: cancelRef,
            disabled: busy === true,
            onClick: onCancel,
          },
          t('cancel'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ar-btn ar-btn--primary',
            disabled: !canImport,
            onClick: onConfirm,
          },
          busy === true ? t('import.busy') : t('import.confirm'),
        ),
      ),
    },
    h('div', { className: 'ar-modal__note' }, t('import.note', { name: fileName })),
    meta.length === 0 ? null : h('div', { className: 'ar-import__meta' }, meta.join(' · ')),
    parseError === '' || parseError === null || parseError === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, parseError),
    error === '' || error === null || error === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, error),
  )
}

module.exports = {
  Modal,
  BatchDeleteDialog,
  MoveDialog,
  SelectionSummary,
  AddBookmarkDialog,
  ImportDialog,
}
      },
"./glyphs.js": function (module, exports, require) {
/**
 * Inline icons taken from the host's 16×16 outline set
 * (`@deepseek-ai/dsh-client-ui-primitives`): Regular weight, 1px stroke.
 * The path data is copied locally instead of importing the Host package so the
 * plugin bundle stays self-contained, but the geometry, weight and sizes follow
 * the host UI. Native names: archive-outline, chevron-right-outline,
 * search-outline, trash-outline, check-outline, close-outline.
 */
const React = require('react')
const h = React.createElement

/** The shared 16×16 outline frame used by every glyph below. */
function Glyph({ size, strokeWidth, children }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: strokeWidth === undefined ? 1 : strokeWidth,
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block' },
    },
    children,
  )
}

/** The archive-box glyph, shared by the sidebar row and the page header. */
function ArchiveGlyph({ size, strokeWidth }) {
  return h(
    Glyph,
    { size: size === undefined ? 20 : size, strokeWidth },
    h('path', {
      d: 'M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z',
    }),
    h('path', {
      d: 'M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5',
    }),
    h('path', { d: 'M6.5 9.5H9.5' }),
  )
}

/** The list-section disclosure arrow. */
function Chevron({ open }) {
  return h(
    'span',
    { className: 'ar-sec__chev' },
    h(
      Glyph,
      { size: 14 },
      h('path', {
        d: 'M6 12L9.29289 8.70711C9.68342 8.31658 9.68342 7.68342 9.29289 7.29289L6 4',
      }),
    ),
  )
}

/** The page-header search glyph. */
function SearchGlyph() {
  return h(
    Glyph,
    { size: 14 },
    h('path', {
      d: 'M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z',
    }),
    h('path', { d: 'M10.2991 10.3933L14.7783 14.8725' }),
  )
}

/** The sidebar row: a 20px native archive glyph that thickens while open. */
function PanelIcon({ size, active }) {
  return h(ArchiveGlyph, { size, strokeWidth: active ? 1.3 : 1 })
}

/** The card's delete affordance. */
function TrashGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', { d: 'M1.28149 3.88831H14.7187' }),
    h('path', {
      d: 'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833',
    }),
    h('path', {
      d: 'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831',
    }),
    h('path', { d: 'M6.44946 6.98926V11.1238' }),
    h('path', { d: 'M9.55054 6.98926V11.1238' }),
  )
}

/** The checkmark inside the selection box. */
function CheckGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 12 : size },
    h('path', {
      d: 'M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4',
    }),
  )
}

/** Small close mark for summary rows. */
function CloseGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 12 : size },
    h('path', { d: 'M2.5 2.5L13.5 13.5' }),
    h('path', { d: 'M13.5 2.5L2.5 13.5' }),
  )
}

/** Add actions: the page header entry and each list's top-right affordance. */
function PlusGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', { d: 'M8 2.25V13.75' }),
    h('path', { d: 'M2.25 8H13.75' }),
  )
}

/** Import: an arrow dropping into a tray. */
function ImportGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', { d: 'M8 1.75V9.75' }),
    h('path', { d: 'M4.75 6.75L8 10L11.25 6.75' }),
    h('path', {
      d: 'M2.25 10.25V13.25C2.25 13.5261 2.47386 13.75 2.75 13.75H13.25C13.5261 13.75 13.75 13.5261 13.75 13.25V10.25',
    }),
  )
}

module.exports = {
  ArchiveGlyph,
  Chevron,
  SearchGlyph,
  PanelIcon,
  TrashGlyph,
  CheckGlyph,
  CloseGlyph,
  PlusGlyph,
  ImportGlyph,
}
      },
"./header.js": function (module, exports, require) {
/** The page header: the plugin name, the add / import entries, and search. */
const React = require('react')
const h = React.createElement
const { ArchiveGlyph, SearchGlyph, PlusGlyph, ImportGlyph } = require('./glyphs.js')

function PageHeader({ t, query, onQueryChange, busy, canMutate, onAddBookmark, onImport }) {
  const tools =
    canMutate === true
      ? h(
          'div',
          { className: 'ar-header__tools' },
          h(
            'button',
            {
              type: 'button',
              className: 'ar-icon-btn ar-header__add',
              title: t('add.title'),
              'aria-label': t('add.title'),
              disabled: busy === true,
              onClick: onAddBookmark,
            },
            h(PlusGlyph, { size: 14 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'ar-icon-btn ar-header__import',
              title: t('import.title'),
              'aria-label': t('import.title'),
              disabled: busy === true,
              onClick: onImport,
            },
            h(ImportGlyph, { size: 14 }),
          ),
        )
      : null

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
    tools,
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
        disabled: busy === true,
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

  select: '选择',
  'select.exit': '取消选择',
  'select.count': '已选 {n} 项',
  'select.groups': '跨 {m} 个分组',
  'select.hidden': '{k} 项不在当前筛选',
  'select.emptyHint': '点选书签以批量操作',
  'select.summary': '已选清单',
  'select.clear': '清除全部',
  'select.remove': '取消选择「{title}」',
  'select.badge': '已选 {n} 项',
  'select.cardAria': '选择「{title}」',
  'select.bar': '批量操作',

  'action.move': '移动',
  'action.delete': '删除',

  'add.title': '新增书签',
  'add.toListAria': '在「{list}」中新增书签',
  'add.url': '链接',
  'add.urlPlaceholder': 'https://example.com/',
  'add.titleLabel': '标题（可选）',
  'add.titlePlaceholder': '留空则使用链接地址',
  'add.target': '添加到',
  'add.group': '分组',
  'add.list': '列表',
  'add.newGroup': '＋ 新建分组…',
  'add.newList': '＋ 新建列表…',
  'add.groupName': '新分组名称',
  'add.groupPlaceholder': '输入新分组名称',
  'add.listName': '新列表名称',
  'add.listPlaceholder': '输入新列表名称',
  'add.confirm': '添加',
  'add.busy': '添加中…',
  'add.done': '已添加书签',
  'add.invalidUrl': '请输入有效的 http(s) 链接',
  'add.missingGroup': '请输入新分组名称',
  'add.missingList': '请输入新列表名称',
  'add.duplicate': '这个列表里已经有相同的链接',
  'add.failed': '添加失败，请重试',

  'import.title': '导入书签',
  'import.note': '将把「{name}」合并到书签库：同名分组 / 列表会合并，重复链接会跳过。',
  'import.summary': '约 {groups} 个分组、{lists} 个列表、{bookmarks} 个书签',
  'import.pick': '重新选择文件',
  'import.confirm': '导入',
  'import.busy': '导入中…',
  'import.done': '已导入 {n} 个书签',
  'import.created': '新增 {g} 个分组、{l} 个列表',
  'import.skipped': '跳过 {k} 个重复 / 无效项',
  'import.nothing': '没有新内容可导入',
  'import.parseFailed': '无法解析这个 JSON 文件',
  'import.shapeFailed': '这个 JSON 缺少 groups → lists → bookmarks 结构',
  'import.tooLarge': '文件过大（上限 8 MB）',
  'import.invalid': '这个 JSON 不是有效的书签库',
  'import.failed': '导入失败，请重试',

  'delete.cardTitle': '删除这个书签？',
  'delete.cardAria': '删除「{title}」',
  'delete.cardConfirm': '删除',
  'delete.batchTitle': '删除 {n} 个书签？',
  'delete.irreversible': '删除后不可恢复。',
  'delete.moreItems': '等 {n} 项',
  'delete.batchConfirm': '确认删除',
  'delete.busy': '删除中…',
  'delete.done.one': '已删除 1 个书签',
  'delete.done.many': '已删除 {n} 个书签',
  'delete.failed': '删除失败，请重试',

  'move.title': '移动 {n} 个书签',
  'move.group': '目标分组',
  'move.list': '目标列表',
  'move.chooseGroup': '请选择目标分组',
  'move.chooseList': '请选择目标列表',
  'move.noLists': '该分组暂无列表',
  'move.emptyTarget': '目标列表为空，将直接放入',
  'move.preview': '将移动到「{group} / {list}」',
  'move.skip': '其中 {k} 项已在目标列表，将跳过',
  'move.same': '所选书签已在该列表中',
  'move.optionSelected': '（已选 {k}）',
  'move.confirm': '移动',
  'move.busy': '移动中…',
  'move.done': '已移动 {n} 个书签到「{group} / {list}」',
  'move.failed': '移动失败，请重试',

  stale: '书签库已在别处更新，已刷新',
  readonly: '书签文件不可写',
  'empty.list': '这个列表还没有书签',
  'empty.group': '这个分组还没有列表',
  'empty.library': '书签库是空的',
  'empty.hint': '编辑 data/bookmarks.json 后点击重新加载',
  reload: '重新加载',
  cancel: '取消',
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

  select: 'Select',
  'select.exit': 'Cancel selection',
  'select.count': '{n} selected',
  'select.groups': 'across {m} groups',
  'select.hidden': '{k} not in the current filter',
  'select.emptyHint': 'Select bookmarks to act on them',
  'select.summary': 'Selection',
  'select.clear': 'Clear all',
  'select.remove': 'Deselect “{title}”',
  'select.badge': '{n} selected',
  'select.cardAria': 'Select “{title}”',
  'select.bar': 'Bulk actions',

  'action.move': 'Move',
  'action.delete': 'Delete',

  'add.title': 'Add bookmark',
  'add.toListAria': 'Add a bookmark to “{list}”',
  'add.url': 'Link',
  'add.urlPlaceholder': 'https://example.com/',
  'add.titleLabel': 'Title (optional)',
  'add.titlePlaceholder': 'Blank uses the link itself',
  'add.target': 'Add to',
  'add.group': 'Group',
  'add.list': 'List',
  'add.newGroup': '+ New group…',
  'add.newList': '+ New list…',
  'add.groupName': 'New group name',
  'add.groupPlaceholder': 'Enter a new group name',
  'add.listName': 'New list name',
  'add.listPlaceholder': 'Enter a new list name',
  'add.confirm': 'Add',
  'add.busy': 'Adding…',
  'add.done': 'Bookmark added',
  'add.invalidUrl': 'Enter a valid http(s) link',
  'add.missingGroup': 'Enter a new group name',
  'add.missingList': 'Enter a new list name',
  'add.duplicate': 'That link is already in this list',
  'add.failed': "Couldn't add the bookmark. Try again.",

  'import.title': 'Import bookmarks',
  'import.note': '“{name}” will be merged into the library: matching groups and lists are reused, and duplicate links are skipped.',
  'import.summary': 'About {groups} groups, {lists} lists, {bookmarks} bookmarks',
  'import.pick': 'Choose another file',
  'import.confirm': 'Import',
  'import.busy': 'Importing…',
  'import.done': 'Imported {n} bookmarks',
  'import.created': 'Added {g} groups and {l} lists',
  'import.skipped': 'Skipped {k} duplicates / invalid items',
  'import.nothing': 'Nothing new to import',
  'import.parseFailed': "Couldn't parse this JSON file",
  'import.shapeFailed': 'This JSON has no groups → lists → bookmarks structure',
  'import.tooLarge': 'The file is too large (8 MB limit)',
  'import.invalid': 'This JSON is not a valid bookmark library',
  'import.failed': "Couldn't import. Try again.",

  'delete.cardTitle': 'Delete this bookmark?',
  'delete.cardAria': 'Delete “{title}”',
  'delete.cardConfirm': 'Delete',
  'delete.batchTitle': 'Delete {n} bookmarks?',
  'delete.irreversible': "This can't be undone.",
  'delete.moreItems': '…and {n} more',
  'delete.batchConfirm': 'Delete',
  'delete.busy': 'Deleting…',
  'delete.done.one': 'Deleted 1 bookmark',
  'delete.done.many': 'Deleted {n} bookmarks',
  'delete.failed': "Couldn't delete. Try again.",

  'move.title': 'Move {n} bookmarks',
  'move.group': 'Group',
  'move.list': 'List',
  'move.chooseGroup': 'Choose a group',
  'move.chooseList': 'Choose a target list',
  'move.noLists': 'This group has no lists',
  'move.emptyTarget': 'The target list is empty',
  'move.preview': 'Move to “{group} / {list}”',
  'move.skip': '{k} already there and will be skipped',
  'move.same': 'The selection is already in that list',
  'move.optionSelected': '({k} selected)',
  'move.confirm': 'Move',
  'move.busy': 'Moving…',
  'move.done': 'Moved {n} bookmarks to “{group} / {list}”',
  'move.failed': "Couldn't move. Try again.",

  stale: 'The library changed elsewhere and was refreshed',
  readonly: 'The bookmark file is read-only',
  'empty.list': 'This list has no bookmarks yet',
  'empty.group': 'This group has no lists yet',
  'empty.library': 'The library is empty',
  'empty.hint': 'Edit data/bookmarks.json, then reload',
  reload: 'Reload',
  cancel: 'Cancel',
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

/**
 * Drops ids that no longer exist from the per-list order. A delete or move
 * changes the library; keeping the old ids would let a bookmark moved away and
 * later back "resurrect" its old slot, and would leave dead entries behind.
 */
function pruneOrder(order, collection) {
  const valid = new Set()
  for (const group of collection.groups) {
    for (const list of group.lists) {
      for (const bookmark of list.bookmarks) valid.add(bookmark.id)
    }
  }

  let changed = false
  const bookmarks = {}
  for (const [listId, ids] of Object.entries(order.bookmarks)) {
    const kept = ids.filter((id) => valid.has(id))
    bookmarks[listId] = kept
    if (kept.length !== ids.length) changed = true
  }
  return changed ? { ...order, bookmarks } : order
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
  pruneOrder,
  orderListBookmarks,
  filterListBookmarks,
}
      },
"./panel.js": function (module, exports, require) {
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
const { TONE_COUNT, MAX_IMPORT_BYTES } = require('./constants.js')
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
const { BatchDeleteDialog, MoveDialog, SelectionSummary, AddBookmarkDialog, ImportDialog } = require('./dialogs.js')

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
  const mountedRef = useRef(true)
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
  /* The bottom bar is only useful with a non-empty selection; an empty one
     leaves the grid in its normal state instead of parking an idle toolbar. */
  const selectionBarVisible = selectionMode && canMutate && entries.length > 0

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
      // Unchecking the last card ends selection mode, so the grid returns to
      // browsing and the bar goes away with it.
      if (next.size === 0) {
        exitSelection()
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
      'data-select-mode': selectionMode ? 'true' : 'false',
      'data-bar-visible': selectionBarVisible ? 'true' : 'false',
      'data-dialog-open': dialogOpen ? 'true' : 'false',
      'data-busy': busy ? 'true' : 'false',
    },
    h('style', { key: 'styles' }, CSS),
    header,
    h('div', { className: 'ar-body' }, side, main),
    dock,
    ...overlays,
    toastNode,
  )
}

module.exports = { Panel }
      },
"./selection.js": function (module, exports, require) {
/**
 * Pure selection helpers. The panel owns the React state; these functions only
 * turn the id set into ordered entries and counts, so the same ordering can
 * drive the bar, the selection summary, and a batch move request.
 */
const { applyOrder, matchesQuery } = require('./order.js')

/** Returns a new Set with `id` toggled. */
function toggleId(selected, id) {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Every selected bookmark in display order: group order, then list order, then
 * card order. Uses the whole library (not the search filter), so a hidden
 * selection keeps its position when it is moved.
 */
function selectedEntries(groups, order, selected) {
  if (selected.size === 0) return []
  const entries = []
  for (const group of applyOrder(groups, order.groups)) {
    for (const list of applyOrder(group.lists, order.lists[group.id] ?? [])) {
      for (const bookmark of applyOrder(list.bookmarks, order.bookmarks[list.id] ?? [])) {
        if (selected.has(bookmark.id)) entries.push({ group, list, bookmark })
      }
    }
  }
  return entries
}

/** Selected count per group id, for the left rail badges. */
function countsByGroup(entries) {
  const counts = new Map()
  for (const entry of entries) {
    counts.set(entry.group.id, (counts.get(entry.group.id) ?? 0) + 1)
  }
  return counts
}

/** How many distinct groups the selection touches. */
function groupCount(entries) {
  return new Set(entries.map((entry) => entry.group.id)).size
}

/** Selected bookmarks the current search hides. */
function hiddenByQuery(entries, query) {
  if (query === '') return 0
  return entries.reduce(
    (total, entry) => total + (matchesQuery(entry.bookmark, query) ? 0 : 1),
    0,
  )
}

/** Split a move into "already there" and "actually moving". */
function targetStats(entries, listId) {
  let inTarget = 0
  for (const entry of entries) {
    if (entry.list.id === listId) inTarget += 1
  }
  return { total: entries.length, inTarget, moving: entries.length - inTarget }
}

/** Fast lookup for the dialog snapshots. */
function entryMap(entries) {
  const map = new Map()
  for (const entry of entries) map.set(entry.bookmark.id, entry)
  return map
}

module.exports = {
  toggleId,
  selectedEntries,
  countsByGroup,
  groupCount,
  hiddenByQuery,
  targetStats,
  entryMap,
}
      },
"./sidebar.js": function (module, exports, require) {
/** The narrow left rail: group selection, drag order, and global stats. */
const React = require('react')
const h = React.createElement
const { GroupRow } = require('./bookmarks.js')
const { Sortable } = require('./sortable.js')
const { TONE_COUNT } = require('./constants.js')

function GroupRail({
  t,
  stats,
  groups,
  groupIds,
  groupMatches,
  selectedByGroup,
  activeGroupId,
  selectionMode,
  busy,
  dragDisabled,
  onSelect,
  onReorder,
}) {
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
        disabled: groupIds.length < 2 || busy === true || selectionMode === true || dragDisabled === true,
        onReorder,
        'aria-label': t('groups'),
      },
      groups.map((group, index) =>
        h(GroupRow, {
          key: group.id,
          t,
          group,
          tone: index % TONE_COUNT,
          count: groupMatches === null ? group.count : groupMatches.get(group.id) ?? 0,
          selectedCount: selectedByGroup.get(group.id) ?? 0,
          active: group.id === activeGroupId,
          dim: groupMatches !== null && (groupMatches.get(group.id) ?? 0) === 0,
          disabled: busy === true,
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
      const interactive =
        target instanceof Element
          ? target.closest('button, input, select, textarea, [data-no-drag]')
          : null;
      /* A group row / list head is itself the drag handle; only an action
         nested inside a card (checkbox, trash, confirm buttons) opts out. */
      if (
        interactive !== null &&
        item !== null &&
        interactive !== item &&
        item.contains(interactive)
      ) {
        return;
      }
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
const CSS = `.ar-root{position:relative;box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding-top:var(--dsh-frame-top-clearance,0px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;--ar-line:var(--dsw-alias-border-l1);--ar-line-strong:var(--dsw-alias-border-l2);--ar-card-lift:3%;--ar-card-lift-hover:6%;--ar-danger:var(--dsw-alias-state-error-primary)}
/* Light surfaces read darker than dark ones at the same mix step, so the light theme lifts much less. The host flags dark mode on <body>. */
body[data-ds-dark-theme] .ar-root{--ar-card-lift:8%;--ar-card-lift-hover:14%}
.ar-root *,.ar-root *::before,.ar-root *::after{box-sizing:border-box}
/* Page header: the plugin name is the page's first-level title. */
.ar-header{flex:none;display:flex;align-items:center;gap:12px;height:50px;padding:0 16px;border-bottom:1px solid var(--ar-line-strong)}
.ar-brand{flex:initial;display:flex;align-items:center;gap:9px;min-width:0}
.ar-brand__glyph{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-brand-primary)}
.ar-brand__name{flex:none;margin:0;font-size:18px;line-height:24px;font-weight:600;letter-spacing:.005em;white-space:nowrap}
.ar-header__spacer{flex:1;min-width:8px}
.ar-header__tools{flex:none;display:flex;align-items:center;gap:4px}
.ar-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid var(--ar-line);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .14s ease,border-color .14s ease,color .14s ease}
.ar-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--ar-line-strong);color:var(--dsw-alias-label-primary)}
.ar-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-icon-btn:disabled{opacity:.5;cursor:default}
.ar-header__add{color:var(--dsw-alias-brand-primary)}
.ar-header__add:hover{color:var(--dsw-alias-brand-primary)}
.ar-search{position:relative;flex:none;display:flex;align-items:center;width:210px;height:28px;border:1px solid var(--ar-line);border-radius:7px;background:var(--dsw-alias-bg-layer-1);transition:border-color .16s ease}
.ar-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.ar-search__glyph{position:absolute;left:7px;display:inline-flex;color:var(--dsw-alias-label-secondary);pointer-events:none}
.ar-search__input{width:100%;height:100%;padding:0 8px 0 26px;border:0;border-radius:inherit;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
.ar-search__input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.ar-search__input:disabled{opacity:.6}
.ar-body{display:flex;flex:1;min-height:0}
/* Left rail. Its band header shares one height with the right column's, so both lists start on the same line. */
.ar-side{flex:none;display:flex;flex-direction:column;width:220px;min-height:0;border-right:1px solid var(--ar-line-strong)}
.ar-side__head{flex:none;display:flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-bottom:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.ar-side__list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:1px;padding:6px 8px 10px}
.ar-side__foot{flex:none;display:flex;flex-direction:column;gap:1px;padding:10px 16px 12px;border-top:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums}
.ar-side__foot span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
/* Keep a fixed 32px basis so a long group list scrolls instead of shrinking every row. */
.ar-group{position:relative;display:flex;flex:0 0 32px;align-items:center;gap:6px;width:100%;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none;transition:background-color .12s ease,color .12s ease}
.ar-group:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
/* The selected group adds its own hue to the base surface: a tinted fill plus a
   2px accent rail on the left edge, so selection reads at a glance even while
   another row is hovered. */
.ar-group[data-active="true"]{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 12%,var(--dsw-alias-bg-base) 88%);color:var(--dsw-alias-label-primary);font-weight:600}
.ar-group[data-active="true"]:hover{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 18%,var(--dsw-alias-bg-base) 82%)}
.ar-group[data-active="true"]::before{content:"";position:absolute;left:3px;top:7px;bottom:7px;width:2px;border-radius:1px;background:var(--ar-group-ink,var(--dsw-alias-brand-primary))}
.ar-group[data-dim="true"]{opacity:.45}
.ar-group:disabled{cursor:default}
.ar-group:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-group__name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600;color:var(--ar-group-ink,var(--dsw-alias-label-primary))}
.ar-group[data-active="true"] .ar-group__name{font-weight:700}
.ar-group__count{flex:none;font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.85}
.ar-group__sel{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted);font-size:10px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
/* Right column: one band header, then the group's lists. Text sits on the 32px rail used by section titles. */
.ar-main{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;padding:0 0 40px}
.ar-root[data-bar-visible="true"] .ar-main{padding-bottom:90px}
/* A group switch remounts this wrapper (keyed by group id), replaying the entry animation. */
.ar-view{min-height:100%;display:flex;flex-direction:column;animation:ar-view-in .26s cubic-bezier(.2,.7,.2,1) both}
.ar-view[data-dir="up"]{--ar-shift:-6px}
.ar-view[data-dir="down"]{--ar-shift:6px}
.ar-main__head{flex:none;display:flex;align-items:center;gap:12px;height:40px;padding:0 16px 0 32px;border-bottom:1px solid var(--ar-line)}
.ar-main__titles{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.ar-main__title{flex:0 1 auto;min-width:0;margin:0;font-size:16px;line-height:22px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ar-group-ink,var(--dsw-alias-label-primary));outline:none}
.ar-main__meta{flex:none;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.ar-main__actions{flex:none;display:flex;align-items:center;gap:4px}
.ar-main__select[data-active="true"]{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary)}
.ar-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color .14s ease,color .14s ease}
.ar-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-btn:disabled{opacity:.5;cursor:default}
.ar-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-btn--danger{border-color:color-mix(in oklab,var(--ar-danger) 30%,transparent);background:color-mix(in oklab,var(--ar-danger) 10%,transparent);color:var(--ar-danger)}
.ar-btn--danger:hover{background:color-mix(in oklab,var(--ar-danger) 16%,transparent);color:var(--ar-danger)}
.ar-btn--primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}
.ar-btn--primary:hover{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 86%,var(--dsw-alias-label-primary) 14%);color:var(--dsw-alias-label-primary-inverted)}
.ar-sections{flex:1 0 auto;display:flex;flex-direction:column;padding:6px 0 0}
.ar-sections>.ar-sec{border-top:1px solid var(--ar-line)}
.ar-sections>.ar-sec:first-child{border-top:0}
.ar-sec__headbar{position:relative;display:flex;align-items:center;height:32px}
.ar-sec__head{position:relative;display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 36px 0 32px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none}
.ar-sec__headbar[data-add="false"] .ar-sec__head{padding-right:16px}
button.ar-sec__head:hover,.ar-sec__headbar:hover button.ar-sec__head:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.ar-sec__head[data-static="true"]{cursor:default}
button.ar-sec__head:disabled{cursor:default}
button.ar-sec__head:disabled:hover{background:transparent}
.ar-sec__head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-sec__add{position:absolute;top:50%;right:8px;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--ar-list-ink-soft,var(--dsw-alias-label-secondary));cursor:pointer;opacity:.7;transform:translateY(-50%);transition:background-color .12s ease,color .12s ease,opacity .12s ease}
.ar-sec__add:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);opacity:1}
.ar-sec__add:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:0;opacity:1}
.ar-sec__add:disabled{opacity:.35;cursor:default}
.ar-sec__chev{flex:none;display:inline-flex;align-items:center;color:var(--ar-list-ink-soft,var(--dsw-alias-label-secondary));transition:transform .16s ease}
.ar-sec[data-open="true"] .ar-sec__chev{transform:rotate(90deg)}
.ar-sec__title{flex:0 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--ar-list-ink,var(--dsw-alias-label-primary))}
.ar-sec__count{flex:none;margin-left:auto;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* The card body stays mounted and animates its row from 0fr to 1fr, so both open and close have a height transition; visibility keeps collapsed cards out of the tab order. */
.ar-sec__body{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s linear .24s}
.ar-sec[data-open="true"] .ar-sec__body{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s}
.ar-sec__inner{min-height:0;overflow:hidden}
.ar-sec__empty{padding:8px 16px 12px 32px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
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
.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:10px;padding:6px 16px 12px 32px}
.ar-sec[data-open="true"] .ar-grid{animation:ar-fade-in .2s ease both}
.ar-sec:not([data-open="true"]) .ar-grid{opacity:0;transition:opacity .18s ease}
/* The card is a positioning context: a transparent full-card anchor carries the
   native link behaviour, while the checkbox / trash / confirm layer sit above it
   as real buttons. Buttons must never be nested inside the anchor. */
.ar-card{position:relative;display:flex;align-items:center;gap:9px;min-width:0;min-height:76px;padding:11px 34px 11px 12px;border:.5px solid var(--ar-line);border-radius:10px;background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift)),var(--dsw-alias-label-primary) var(--ar-card-lift));color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;user-select:none;-webkit-touch-callout:none;-webkit-user-drag:none;transition:border-color .16s ease,background-color .16s ease}
/* Card surface = the sidebar fill nudged a fixed step towards the theme's text colour, so any theme (even one whose fill equals its base) keeps a visible card/background delta. Tune it with the --ar-card-lift variables on .ar-root. */
.ar-card:hover{border-color:var(--dsw-alias-border-l2);background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift-hover)),var(--dsw-alias-label-primary) var(--ar-card-lift-hover))}
.ar-card[data-selected="true"]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 9%,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) 91%)}
.ar-card[data-selected="true"]:hover{border-color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 13%,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) 87%)}
.ar-card__link{position:absolute;inset:0;z-index:0;display:block;border-radius:inherit;text-decoration:none}
.ar-card__link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-card[data-confirming="true"] .ar-card__link{pointer-events:none}
.ar-card__lead{position:relative;z-index:1;flex:none;width:18px;height:18px;pointer-events:none}
.ar-card__title{position:relative;z-index:1;min-width:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;pointer-events:none}
.ar-fav{flex:none;width:18px;height:18px;border-radius:4px;object-fit:contain;transition:opacity .12s ease}
.ar-fav--letter{display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;line-height:1}
.ar-card:hover .ar-fav,.ar-card__link:focus-visible ~ .ar-card__lead .ar-fav,.ar-card[data-selected="true"] .ar-fav{opacity:0}
.ar-card__check{position:absolute;inset:0;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:1.5px solid var(--dsw-alias-label-tertiary);border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary-inverted);cursor:pointer;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,visibility 0s linear .12s,border-color .12s ease,background-color .12s ease}
.ar-card:hover .ar-card__check,.ar-card__link:focus-visible ~ .ar-card__lead .ar-card__check,.ar-card__check:focus-visible,.ar-card[data-selected="true"] .ar-card__check{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .12s ease,visibility 0s,border-color .12s ease,background-color .12s ease}
/* Selection mode only changes what a click does. Unselected cards keep their
   favicon and stay visually identical to the browsing state; their box appears
   on hover or keyboard focus, while selected cards keep the checked box. The
   idle box keeps its visibility so Tab can still reach it — the keyboard
   focus rule above then reveals it. */
.ar-card[data-selecting="true"] .ar-card__check{visibility:visible}
.ar-card__check:hover{border-color:var(--dsw-alias-brand-primary)}
.ar-card__check[data-checked="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}
.ar-card__check:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-card__check:disabled{cursor:default}
/* Dim a disabled box only where it is actually revealed; a bare :disabled
   opacity would otherwise paint every idle box during a save. */
.ar-card:hover .ar-card__check:disabled,.ar-card[data-selected="true"] .ar-card__check:disabled{opacity:.6}
/* Unchecking with the pointer puts the box away at once, even while the
   pointer still rests on the card; leaving and hovering again brings it back.
   Keyboard focus still wins, so a focused box never hides from the keyboard. */
.ar-card[data-suppress-check="true"]:hover .ar-card__check:not(:focus-visible){opacity:0;pointer-events:none}
.ar-card[data-suppress-check="true"]:hover .ar-fav{opacity:1}
.ar-card__trash{position:absolute;top:50%;right:4px;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--ar-danger);cursor:pointer;opacity:0;pointer-events:none;transform:translateY(-50%);transition:opacity .12s ease,background-color .12s ease}
.ar-card:hover .ar-card__trash,.ar-card:focus-within .ar-card__trash{opacity:1;pointer-events:auto}
.ar-card__trash:hover{background:color-mix(in oklab,var(--ar-danger) 14%,transparent)}
.ar-card__trash:focus-visible{outline:2px solid var(--ar-danger);outline-offset:0}
.ar-card__trash:disabled{cursor:default;opacity:.35}
.ar-card[data-selecting="true"] .ar-card__trash,.ar-card[data-confirming="true"] .ar-card__trash{display:none}
.ar-card__confirm{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:4px;padding:6px 8px;border-radius:inherit;background:color-mix(in oklab,var(--dsw-alias-bg-base) 94%,var(--ar-danger) 6%);transform-origin:right center;animation:ar-confirm-in .2s cubic-bezier(.2,.7,.2,1) both}
.ar-card__confirm-text{flex:none;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11.5px;font-weight:600;line-height:16px;color:var(--ar-danger);text-align:center}
.ar-card__confirm-actions{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0}
/* Cancel plays the entrance in reverse: back towards the trash on the right. */
.ar-card__confirm[data-leaving="true"]{animation:ar-confirm-out .16s cubic-bezier(.4,0,.6,1) both}
.ar-card__confirm-btn{flex:none;height:22px;padding:0 6px;border:1px solid var(--ar-line-strong);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:20px;cursor:pointer;white-space:nowrap}
.ar-card__confirm-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-card__confirm-btn--danger{border-color:color-mix(in oklab,var(--ar-danger) 30%,transparent);background:color-mix(in oklab,var(--ar-danger) 12%,transparent);color:var(--ar-danger)}
.ar-card__confirm-btn--danger:hover{background:color-mix(in oklab,var(--ar-danger) 18%,transparent);color:var(--ar-danger)}
.ar-card__confirm-btn:disabled{opacity:.55;cursor:default}
.ar-card__confirm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
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
.ar-state{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 24px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.ar-state__title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}
.ar-state__hint{max-width:420px;font-size:12.5px;line-height:18px}
.ar-toast{position:fixed;z-index:1400;left:50%;bottom:26px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 48px));padding:7px 14px;border:1px solid var(--ar-line);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 28px rgba(0,0,0,.2)}
.ar-root[data-select-mode="true"] .ar-toast,.ar-root[data-dialog-open="true"] .ar-toast{opacity:0;pointer-events:none}
/* Floating bulk-action dock: the summary stacks above the bar. The dock itself
   is click-through so the area beside the pill stays usable. */
.ar-bar-dock{position:absolute;z-index:1100;left:220px;right:0;bottom:16px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
.ar-bar{pointer-events:auto;display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);height:44px;padding:0 8px 0 14px;border:1px solid var(--ar-line-strong);border-radius:999px;background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 32px rgba(0,0,0,.22);animation:ar-bar-in .18s cubic-bezier(.2,.7,.2,1) both}
.ar-bar__count{min-width:0;max-width:56%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:28px;cursor:pointer;font-variant-numeric:tabular-nums}
.ar-bar__count:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-bar__count:disabled{cursor:default;opacity:.7}
.ar-bar__actions{display:flex;align-items:center;gap:2px}
.ar-bar__btn{height:28px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}
.ar-bar__btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-bar__btn--danger{color:var(--ar-danger)}
.ar-bar__btn--danger:hover{background:color-mix(in oklab,var(--ar-danger) 12%,transparent);color:var(--ar-danger)}
.ar-bar__btn:disabled{opacity:.45;cursor:default;background:transparent}
.ar-bar__btn:focus-visible,.ar-bar__count:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-summary{pointer-events:auto;width:min(440px,calc(100% - 32px));max-height:320px;display:flex;flex-direction:column;border:1px solid var(--ar-line-strong);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 44px rgba(0,0,0,.28);overflow:hidden;outline:none;animation:ar-bar-in .16s cubic-bezier(.2,.7,.2,1) both}
.ar-summary__head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--ar-line);font-size:12px;font-weight:600}
.ar-summary__clear{padding:2px 6px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer}
.ar-summary__clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-summary__body{min-height:0;overflow-y:auto;padding:4px 0}
.ar-summary__group{padding:4px 0}
.ar-summary__group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:4px 12px;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer}
.ar-summary__group-head:hover{background:var(--dsw-alias-bg-layer-2)}
.ar-summary__group-count{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500}
.ar-summary__list{padding:1px 12px 3px 20px}
.ar-summary__list-head{padding:2px 0;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500}
.ar-summary__item{display:flex;align-items:center;gap:6px;padding:2px 0}
.ar-summary__item-title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;color:var(--dsw-alias-label-primary)}
.ar-summary__remove{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ar-summary__remove:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-summary__remove:focus-visible,.ar-summary__clear:focus-visible,.ar-summary__group-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-summary__foot{flex:none;display:flex;justify-content:flex-end;padding:6px 10px;border-top:1px solid var(--ar-line)}
/* Modal shell shares the panel's token language; the scrim covers only the
   archive panel, not the host shell around it. */
.ar-modal{position:absolute;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.35));animation:ar-fade-in .16s ease both}
.ar-modal__panel{width:min(420px,100%);max-height:calc(100% - 24px);overflow-y:auto;padding:16px;border:1px solid var(--ar-line-strong);border-radius:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:0 24px 60px rgba(0,0,0,.32);animation:ar-modal-in .16s cubic-bezier(.2,.7,.2,1) both}
.ar-modal__title{font-size:14px;line-height:20px;font-weight:600;letter-spacing:-.005em}
/* Delete dialogs tint their heading and warning with the same red as every other delete affordance. */
.ar-modal__panel[data-tone="danger"] .ar-modal__title,.ar-modal__panel[data-tone="danger"] .ar-modal__note{color:var(--ar-danger)}
.ar-modal__body{margin-top:10px}
.ar-modal__note{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.ar-modal__hint{display:flex;flex-direction:column;gap:2px;margin-top:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.ar-modal__hint-soft{color:var(--dsw-alias-label-tertiary);font-size:11px}
.ar-modal__error{margin-top:10px;color:var(--ar-danger);font-size:12px;line-height:17px}
.ar-modal__actions{display:flex;justify-content:flex-end;gap:6px;margin-top:16px}
.ar-pick-list{list-style:none;max-height:180px;overflow-y:auto;margin:8px 0 0;padding:0;border-top:1px solid var(--ar-line)}
.ar-pick-list__row{display:flex;flex-direction:column;gap:1px;padding:6px 0;border-bottom:1px solid var(--ar-line)}
.ar-pick-list__path{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:15px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-pick-list__title{font-size:12px;line-height:17px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-pick-list__more{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.ar-form__field{display:block;margin-bottom:12px}
.ar-form__label{display:block;margin-bottom:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.01em}
.ar-form__select{width:100%;height:30px;padding:0 6px;border:1px solid var(--ar-line);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}
.ar-form__select:focus{border-color:var(--dsw-alias-brand-primary)}
.ar-form__select:disabled{opacity:.6}
.ar-form__input{width:100%;height:30px;padding:0 8px;border:1px solid var(--ar-line);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}
.ar-form__input:focus{border-color:var(--dsw-alias-brand-primary)}
.ar-form__input:disabled{opacity:.6}
.ar-form__input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.ar-form__target{display:flex;flex-direction:column;gap:3px;margin-bottom:12px;padding:8px 10px;border:1px solid var(--ar-line);border-radius:6px;background:var(--dsw-alias-bg-layer-1)}
.ar-form__target-value{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary)}
.ar-import__meta{margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums}
@keyframes ar-fade-in{from{opacity:0}}
@keyframes ar-confirm-in{from{opacity:0;transform:translateX(10px) scale(.96)}}
@keyframes ar-confirm-out{to{opacity:0;transform:translateX(10px) scale(.96)}}
@keyframes ar-view-in{from{opacity:0;transform:translateY(var(--ar-shift,6px))}}
@keyframes ar-bar-in{from{opacity:0;transform:translateY(8px)}}
@keyframes ar-modal-in{from{opacity:0;transform:translateY(4px) scale(.985)}}
.ar-toast{animation:ar-fade-in .16s ease both}
@media (max-width:720px){.ar-bar-dock{left:0}.ar-modal{padding:12px}.ar-modal__panel{width:100%}}
@media (prefers-reduced-motion:reduce){.ar-toast,.ar-view,.ar-sec__body,.ar-sec__chev,.ar-grid,.ar-card,.ar-card__check,.ar-card__trash,.ar-card__confirm,.ar-card__confirm[data-leaving="true"],.ar-bar,.ar-summary,.ar-modal,.ar-modal__panel{animation:none;transition:none}}`

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
