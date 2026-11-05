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
