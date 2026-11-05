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
