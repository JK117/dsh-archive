/**
 * The split handle between the group rail and the bookmarks column. It only
 * reports widths; `panel.js` owns the state, the CSS variable, and persistence.
 */
const React = require('react')
const h = React.createElement
const {
  RAIL_WIDTH_DEFAULT,
  RAIL_WIDTH_MIN,
  RAIL_WIDTH_STEP,
} = require('./constants.js')
const { clampRailWidth } = require('./rail.js')

function RailResizer({ t, width, max, onChange, onCommit }) {
  const [dragging, setDragging] = React.useState(false)
  const handleRef = React.useRef(null)
  const dragRef = React.useRef(null)
  const widthRef = React.useRef(width)
  const maxRef = React.useRef(max)
  widthRef.current = width
  maxRef.current = max

  React.useEffect(() => {
    if (!dragging) return undefined
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
    }
  }, [dragging])

  const remember = (next) => {
    widthRef.current = next
    onChange(next)
  }

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    handleRef.current = event.currentTarget
    event.currentTarget.focus?.({ preventScroll: true })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: widthRef.current,
    }
    setDragging(true)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    remember(
      clampRailWidth(drag.startWidth + event.clientX - drag.startX, maxRef.current),
    )
  }

  const finish = (event) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onCommit(widthRef.current)
  }

  const cancel = (event) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    remember(drag.startWidth)
    onCommit(drag.startWidth)
  }

  const onKeyDown = (event) => {
    const step = event.shiftKey ? RAIL_WIDTH_STEP * 4 : RAIL_WIDTH_STEP
    let next = null
    if (event.key === 'ArrowLeft') next = widthRef.current - step
    else if (event.key === 'ArrowRight') next = widthRef.current + step
    else if (event.key === 'Home') next = RAIL_WIDTH_MIN
    else if (event.key === 'End') next = maxRef.current
    else return
    event.preventDefault()
    next = clampRailWidth(next, maxRef.current)
    remember(next)
    onCommit(next)
  }

  const onDoubleClick = () => {
    const next = clampRailWidth(RAIL_WIDTH_DEFAULT, maxRef.current)
    remember(next)
    onCommit(next)
  }

  return h('div', {
    className: 'ar-resizer',
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': t('resizeRail'),
    'aria-valuemin': RAIL_WIDTH_MIN,
    'aria-valuemax': max,
    'aria-valuenow': width,
    title: t('resizeRailHint'),
    tabIndex: 0,
    'data-dragging': dragging ? 'true' : 'false',
    ref: handleRef,
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: cancel,
    onLostPointerCapture: () => {
      if (dragRef.current === null) return
      dragRef.current = null
      setDragging(false)
      onCommit(widthRef.current)
    },
    onKeyDown,
    onDoubleClick,
  })
}

module.exports = { RailResizer }
