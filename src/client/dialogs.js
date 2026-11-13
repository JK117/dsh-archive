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
const { MAX_NAME_LENGTH } = require('./constants.js')

function focusablesIn(panel) {
  if (panel === null) return []
  return Array.from(
    panel.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]'),
  ).filter((element) => element.offsetParent !== null)
}

/** A centered modal with a scrim, focus trap, Escape, and outside-click. */
function Modal({
  title,
  children,
  footer,
  onCancel,
  busy,
  initialFocusRef,
  selectInitial,
  width,
  tone,
}) {
  const panelRef = useRef(null)
  const wasBusy = useRef(false)

  useEffect(() => {
    const preferred =
      (initialFocusRef !== undefined && initialFocusRef.current !== null
        ? initialFocusRef.current
        : null) ?? focusablesIn(panelRef.current)[0]
    if (preferred !== null && typeof preferred.focus === 'function') preferred.focus()
    if (selectInitial === true && preferred !== null && typeof preferred.select === 'function') {
      preferred.select()
    }
  }, [initialFocusRef, selectInitial])

  /* Disabling the focused button during a write drops focus to the body. If
     that write fails, the modal stays open, so bring focus back to it. */
  useEffect(() => {
    if (wasBusy.current && busy !== true && panelRef.current !== null) {
      const active = document.activeElement
      if (active === null || typeof active !== 'object' || !panelRef.current.contains(active)) {
        const preferred =
          (initialFocusRef !== undefined && initialFocusRef.current !== null
            ? initialFocusRef.current
            : null) ?? focusablesIn(panelRef.current)[0]
        if (preferred !== null && typeof preferred.focus === 'function') preferred.focus()
      }
    }
    wasBusy.current = busy === true
  }, [busy, initialFocusRef])

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

/**
 * The one danger confirmation used by every delete path: the existing batch
 * delete, deleting a whole group, and deleting one list. `rows` are plain text
 * previews, so callers choose what is useful to see before confirming.
 */
function ConfirmDeleteDialog({
  t,
  title,
  note,
  summary,
  rows = [],
  more,
  confirmLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null)

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
          busy === true ? t('delete.busy') : confirmLabel,
        ),
      ),
    },
    note === undefined || note === ''
      ? null
      : h('div', { className: 'ar-modal__note' }, note),
    summary === undefined || summary === ''
      ? null
      : h('div', { className: 'ar-modal__hint' }, summary),
    rows.length === 0
      ? null
      : h(
          'ul',
          { className: 'ar-pick-list' },
          rows.map((row, index) =>
            h(
              'li',
              { key: String(index), className: 'ar-pick-list__row' },
              row.path === undefined || row.path === ''
                ? null
                : h('span', { className: 'ar-pick-list__path' }, row.path),
              h('span', { className: 'ar-pick-list__title', title: row.title }, row.title),
            ),
          ),
          more === undefined || more === ''
            ? null
            : h('li', { className: 'ar-pick-list__row ar-pick-list__more' }, more),
        ),
    error === '' || error === null || error === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, error),
  )
}

/** Delete N selected bookmarks, after one explicit confirmation. */
function BatchDeleteDialog({ t, entries, busy, error, onCancel, onConfirm }) {
  const visible = entries.slice(0, 4)
  const remaining = entries.length - visible.length

  return h(ConfirmDeleteDialog, {
    t,
    title: t('delete.batchTitle', { n: entries.length }),
    note: t('delete.irreversible'),
    rows: visible.map((entry) => ({
      path: entry.group.name + ' / ' + entry.list.title,
      title: entry.bookmark.title,
    })),
    more: remaining > 0 ? t('delete.moreItems', { n: remaining }) : '',
    confirmLabel: t('delete.batchConfirm'),
    busy,
    error,
    onCancel,
    onConfirm,
  })
}

/** Delete one whole group or one list, after previewing what it contains. */
function StructureDeleteDialog({
  t,
  scope,
  name,
  lists,
  bookmarks,
  rows,
  more,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  const isGroup = scope === 'group'
  return h(ConfirmDeleteDialog, {
    t,
    title: isGroup
      ? t('delete.groupTitle', { name })
      : t('delete.listTitle', { name }),
    note: t('delete.irreversible'),
    summary: isGroup
      ? lists === 0 && bookmarks === 0
        ? ''
        : t('delete.groupSummary', { lists, bookmarks })
      : bookmarks === 0
        ? ''
        : t('delete.listSummary', { bookmarks }),
    rows,
    more,
    confirmLabel: isGroup ? t('delete.groupConfirm') : t('delete.listConfirm'),
    busy,
    error,
    onCancel,
    onConfirm,
  })
}

/**
 * Rename a group or list. The current value is preselected so typing replaces
 * it, while an unchanged submit just closes the modal without a Host write.
 */
function RenameDialog({ t, scope, value, busy, error, onCancel, onConfirm, onDirty }) {
  const [name, setName] = useState(value)
  const [localError, setLocalError] = useState('')
  const inputRef = useRef(null)

  const submit = () => {
    if (busy === true) return
    const next = name.trim()
    if (next === '') {
      setLocalError(t('rename.required'))
      if (inputRef.current !== null) inputRef.current.focus()
      return
    }
    if (next === value) {
      onCancel()
      return
    }
    setLocalError('')
    onConfirm(next)
  }

  const message = localError !== '' ? localError : error
  return h(
    Modal,
    {
      title: scope === 'group' ? t('rename.groupTitle') : t('rename.listTitle'),
      onCancel,
      busy,
      initialFocusRef: inputRef,
      selectInitial: true,
      width: 'min(420px, 100%)',
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
          busy === true ? t('rename.busy') : t('rename.confirm'),
        ),
      ),
    },
    h(
      'label',
      { className: 'ar-form__field' },
      h(
        'span',
        { className: 'ar-form__label' },
        scope === 'group' ? t('rename.groupLabel') : t('rename.listLabel'),
      ),
      h('input', {
        className: 'ar-form__input',
        ref: inputRef,
        type: 'text',
        value: name,
        maxLength: MAX_NAME_LENGTH,
        spellCheck: false,
        disabled: busy === true,
        onChange: (event) => {
          setName(event.target.value)
          setLocalError('')
          if (typeof onDirty === 'function') onDirty()
        },
        onKeyDown: (event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          submit()
        },
      }),
    ),
    message === '' || message === null || message === undefined
      ? null
      : h('div', { className: 'ar-modal__error', role: 'alert' }, message),
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
  StructureDeleteDialog,
  RenameDialog,
  MoveDialog,
  SelectionSummary,
  AddBookmarkDialog,
  ImportDialog,
}
