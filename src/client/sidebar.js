/** The narrow left rail: group selection, drag order, and global stats. */
const React = require('react')
const h = React.createElement
const { useCallback, useEffect, useRef } = React
const { GroupRow } = require('./bookmarks.js')
const { Sortable } = require('./sortable.js')
const { TONE_COUNT, RAIL_SCROLLBAR_HIDE_MS } = require('./constants.js')

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
  const scrollTimerRef = useRef(0)

  /* The rail's scrollbar is an overlay hint rather than permanent chrome:
     reveal it on scroll, then put it away once the list has been still for
     RAIL_SCROLLBAR_HIDE_MS. The attribute is written straight to the DOM, so
     scrolling never re-renders the list. */
  const handleScroll = useCallback((event) => {
    const list = event.currentTarget
    if (list === null || list === undefined) return
    list.setAttribute('data-scrolling', 'true')
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = 0
      list.removeAttribute('data-scrolling')
    }, RAIL_SCROLLBAR_HIDE_MS)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(scrollTimerRef.current)
    },
    [],
  )

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
        onScroll: handleScroll,
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
