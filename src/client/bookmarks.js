/** Presentational pieces of the library: group rows, list sections, cards. */
const React = require('react')
const h = React.createElement
const { useState, useEffect, useRef } = React
const { Chevron, CheckGlyph, TrashGlyph } = require('./glyphs.js')
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

  useEffect(() => {
    if (confirming && cancelRef.current !== null) cancelRef.current.focus()
  }, [confirming])

  useEffect(() => {
    if (!confirming) return undefined
    const onPointerDown = (event) => {
      if (deleteBusy) return
      if (cardRef.current !== null && !cardRef.current.contains(event.target)) {
        onCancelDelete()
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
      if (!deleteBusy) onCancelDelete()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming, deleteBusy, onCancelDelete])

  const onConfirmKeyDown = (event) => {
    if (event.key !== 'Tab') return
    const cancel = cancelRef.current
    const confirm = confirmRef.current
    if (cancel === null || confirm === null) return
    if (event.shiftKey && document.activeElement === cancel) {
      event.preventDefault()
      confirm.focus()
    } else if (!event.shiftKey && document.activeElement === confirm) {
      event.preventDefault()
      cancel.focus()
    }
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
          onToggle(bookmark.id)
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
            onToggle(bookmark.id)
          },
        },
        selected ? h(CheckGlyph, { size: 11 }) : null,
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
            onClick: (event) => event.stopPropagation(),
            onKeyDown: onConfirmKeyDown,
          },
          h('span', { className: 'ar-card__confirm-text', id: confirmLabelId }, t('delete.cardTitle')),
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
                onCancelDelete()
              },
            },
            t('cancel'),
          ),
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
                onConfirmDelete()
              },
            },
            deleteBusy === true ? t('delete.busy') : t('delete.cardConfirm'),
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
  onOpen,
  onToggleSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onReorderBookmarks,
}) {
  const inner = [
    h(Chevron, { key: 'chev', open }),
    h('span', { key: 'title', className: 'ar-sec__title' }, list.title),
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
    head,
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
