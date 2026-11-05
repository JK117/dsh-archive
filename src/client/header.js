/** The page header: the plugin name and the live search field. */
const React = require('react')
const h = React.createElement
const { ArchiveGlyph, SearchGlyph } = require('./glyphs.js')

function PageHeader({ t, query, onQueryChange }) {
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
        onChange: (event) => onQueryChange(event.target.value),
      }),
    ),
  )
}

module.exports = { PageHeader }
