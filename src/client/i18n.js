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
}

module.exports = { zh, en }
