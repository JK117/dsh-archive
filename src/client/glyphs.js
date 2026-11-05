/** Small inline SVGs shared by the sidebar row and the panel. */
const React = require('react')
const h = React.createElement

/** The archive-box glyph, shared by the sidebar row and the page header. */
function ArchiveGlyph({ size, strokeWidth }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: strokeWidth === undefined ? 1.7 : strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block' },
    },
    h('rect', { x: 3, y: 3.8, width: 18, height: 4.6, rx: 1.2 }),
    h('path', { d: 'M4.6 8.4v9.5c0 1 .8 1.8 1.8 1.8h11.2c1 0 1.8-.8 1.8-1.8V8.4' }),
    h('path', { d: 'M9.9 12.6h4.2' }),
  )
}

/** The list-section disclosure arrow. */
function Chevron({ open }) {
  return h(
    'span',
    { className: 'ar-sec__chev' },
    h(
      'svg',
      {
        width: 12,
        height: 12,
        viewBox: '0 0 12 12',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      h('path', { d: 'M4.5 2.5 8 6l-3.5 3.5' }),
    ),
  )
}

/** The page-header search glyph. */
function SearchGlyph() {
  return h(
    'svg',
    {
      width: 13,
      height: 13,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('circle', { cx: 7, cy: 7, r: 4.4 }),
    h('path', { d: 'm10.4 10.4 3 3' }),
  )
}

/** The sidebar row: a 20px glyph that thickens while its panel is open. */
function PanelIcon({ size, active }) {
  return h(ArchiveGlyph, { size, strokeWidth: active ? 1.9 : 1.7 })
}

/** The card's delete affordance. */
function TrashGlyph({ size }) {
  return h(
    'svg',
    {
      width: size === undefined ? 14 : size,
      height: size === undefined ? 14 : size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M2.6 4.2h10.8' }),
    h('path', { d: 'M5.2 4.2V3.1c0-.5.4-.9.9-.9h3.8c.5 0 .9.4.9.9v1.1' }),
    h('path', { d: 'M4.1 4.2l.6 8.1c0 .5.4.9.9.9h4.8c.5 0 .9-.4.9-.9l.6-8.1' }),
    h('path', { d: 'M6.7 6.8v3.9M9.3 6.8v3.9' }),
  )
}

/** The checkmark inside the selection box. */
function CheckGlyph({ size }) {
  return h(
    'svg',
    {
      width: size === undefined ? 11 : size,
      height: size === undefined ? 11 : size,
      viewBox: '0 0 12 12',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.9,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M2.2 6.2 4.9 8.9 9.8 3.6' }),
  )
}

/** Small close mark for summary rows. */
function CloseGlyph({ size }) {
  return h(
    'svg',
    {
      width: size === undefined ? 11 : size,
      height: size === undefined ? 11 : size,
      viewBox: '0 0 12 12',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M3 3l6 6M9 3 3 9' }),
  )
}

module.exports = { ArchiveGlyph, Chevron, SearchGlyph, PanelIcon, TrashGlyph, CheckGlyph, CloseGlyph }
