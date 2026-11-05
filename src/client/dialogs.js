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

module.exports = { Modal, BatchDeleteDialog, MoveDialog, SelectionSummary }
