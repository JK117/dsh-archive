/**
 * Inline icons taken from the host's 16×16 outline set
 * (`@deepseek-ai/dsh-client-ui-primitives`): Regular weight, 1px stroke.
 * The path data is copied locally instead of importing the Host package so the
 * plugin bundle stays self-contained, but the geometry, weight and sizes follow
 * the host UI. Native names: archive-outline, chevron-right-outline,
 * search-outline, trash-outline, check-outline, close-outline, ellipsis-outline,
 * edit-outline.
 */
const React = require('react')
const h = React.createElement

/** The shared 16×16 outline frame used by every glyph below. */
function Glyph({ size, strokeWidth, children }) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: strokeWidth === undefined ? 1 : strokeWidth,
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block' },
    },
    children,
  )
}

/** The archive-box glyph, shared by the sidebar row and the page header. */
function ArchiveGlyph({ size, strokeWidth }) {
  return h(
    Glyph,
    { size: size === undefined ? 20 : size, strokeWidth },
    h('path', {
      d: 'M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z',
    }),
    h('path', {
      d: 'M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5',
    }),
    h('path', { d: 'M6.5 9.5H9.5' }),
  )
}

/** The list-section disclosure arrow. */
function Chevron({ open }) {
  return h(
    'span',
    { className: 'ar-sec__chev' },
    h(
      Glyph,
      { size: 14 },
      h('path', {
        d: 'M6 12L9.29289 8.70711C9.68342 8.31658 9.68342 7.68342 9.29289 7.29289L6 4',
      }),
    ),
  )
}

/** The page-header search glyph. */
function SearchGlyph() {
  return h(
    Glyph,
    { size: 14 },
    h('path', {
      d: 'M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z',
    }),
    h('path', { d: 'M10.2991 10.3933L14.7783 14.8725' }),
  )
}

/** The sidebar row: a 20px native archive glyph that thickens while open. */
function PanelIcon({ size, active }) {
  return h(ArchiveGlyph, { size, strokeWidth: active ? 1.3 : 1 })
}

/** The card's delete affordance. */
function TrashGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', { d: 'M1.28149 3.88831H14.7187' }),
    h('path', {
      d: 'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833',
    }),
    h('path', {
      d: 'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831',
    }),
    h('path', { d: 'M6.44946 6.98926V11.1238' }),
    h('path', { d: 'M9.55054 6.98926V11.1238' }),
  )
}

/** The checkmark inside the selection box. */
function CheckGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 12 : size },
    h('path', {
      d: 'M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4',
    }),
  )
}

/** Small close mark for summary rows. */
function CloseGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 12 : size },
    h('path', { d: 'M2.5 2.5L13.5 13.5' }),
    h('path', { d: 'M13.5 2.5L2.5 13.5' }),
  )
}

/** Add actions: the page header entry and each list's top-right affordance. */
function PlusGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', { d: 'M8 2.25V13.75' }),
    h('path', { d: 'M2.25 8H13.75' }),
  )
}

/**
 * The shared "more actions" trigger. Host menus use three filled 1px dots on
 * the same 16×16 frame, so it reads as part of the outline icon set.
 */
function EllipsisGlyph({ size }) {
  const px = size === undefined ? 14 : size
  return h(
    'svg',
    {
      width: px,
      height: px,
      viewBox: '0 0 16 16',
      fill: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block' },
    },
    h('path', {
      d: 'M3 9C3.55228 9 4 8.55228 4 8C4 7.44772 3.55228 7 3 7C2.44772 7 2 7.44772 2 8C2 8.55228 2.44772 9 3 9Z',
      fill: 'currentColor',
    }),
    h('path', {
      d: 'M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z',
      fill: 'currentColor',
    }),
    h('path', {
      d: 'M13 9C13.5523 9 14 8.55228 14 8C14 7.44772 13.5523 7 13 7C12.4477 7 12 7.44772 12 8C12 8.55228 12.4477 9 13 9Z',
      fill: 'currentColor',
    }),
  )
}

/** The rename affordance inside a menu. */
function EditGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', {
      d: 'M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z',
      fill: 'currentColor',
      stroke: 'none',
    }),
    h('path', {
      d: 'M7.7849 8.23878L13.888 2.13574',
      fill: 'none',
    }),
  )
}

/** Import: an arrow dropping into a tray. */
function ImportGlyph({ size }) {
  return h(
    Glyph,
    { size: size === undefined ? 14 : size },
    h('path', { d: 'M8 1.75V9.75' }),
    h('path', { d: 'M4.75 6.75L8 10L11.25 6.75' }),
    h('path', {
      d: 'M2.25 10.25V13.25C2.25 13.5261 2.47386 13.75 2.75 13.75H13.25C13.5261 13.75 13.75 13.5261 13.75 13.25V10.25',
    }),
  )
}

module.exports = {
  ArchiveGlyph,
  Chevron,
  SearchGlyph,
  PanelIcon,
  TrashGlyph,
  CheckGlyph,
  CloseGlyph,
  PlusGlyph,
  ImportGlyph,
  EllipsisGlyph,
  EditGlyph,
}
