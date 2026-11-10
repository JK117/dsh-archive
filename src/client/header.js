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
