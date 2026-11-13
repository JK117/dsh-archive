/**
 * The shared "more actions" menu used by both the group header and each list
 * header. One trigger + one popover keeps the two surfaces identical and gives
 * the keyboard the same behavior everywhere: arrows move, Home/End jump, Esc
 * closes and returns focus, and Tab moves out naturally. The menu closes once
 * focus leaves the trigger + popover, so the browser keeps the next tab stop.
 */
const React = require('react')
const h = React.createElement
const { useEffect, useRef, useState } = React
const { EllipsisGlyph } = require('./glyphs.js')

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])'

function MoreMenu({ label, items, disabled, className }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('down')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (disabled === true) setOpen(false)
  }, [disabled])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current !== null && rootRef.current.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const frame = requestAnimationFrame(() => {
      const first = menuRef.current === null ? null : menuRef.current.querySelector(ITEM_SELECTOR)
      if (first !== null) first.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const focusItem = (index) => {
    if (menuRef.current === null) return
    const nodes = Array.from(menuRef.current.querySelectorAll(ITEM_SELECTOR))
    if (nodes.length === 0) return
    const at = index < 0 ? nodes.length - 1 : index % nodes.length
    nodes[at].focus({ preventScroll: true })
  }

  /* Lists near the bottom of the scroll area open their menu upwards instead
     of letting it fall past the viewport edge. */
  const placeMenu = () => {
    if (triggerRef.current === null || typeof window === 'undefined') return
    const rect = triggerRef.current.getBoundingClientRect()
    setPlacement(window.innerHeight - rect.bottom < 150 ? 'up' : 'down')
  }

  const openMenu = () => {
    placeMenu()
    setOpen(true)
  }

  const close = (focusTrigger) => {
    setOpen(false)
    if (focusTrigger && triggerRef.current !== null) {
      requestAnimationFrame(() => {
        if (triggerRef.current !== null && triggerRef.current.isConnected) {
          triggerRef.current.focus({ preventScroll: true })
        }
      })
    }
  }

  const onMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (menuRef.current === null) return
    const nodes = Array.from(menuRef.current.querySelectorAll(ITEM_SELECTOR))
    if (nodes.length === 0) return
    const current = nodes.indexOf(document.activeElement)

    let next = null
    if (event.key === 'ArrowDown') next = current + 1
    else if (event.key === 'ArrowUp') next = current < 0 ? nodes.length - 1 : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = nodes.length - 1
    else return

    event.preventDefault()
    nodes[(next + nodes.length) % nodes.length].focus({ preventScroll: true })
  }

  const onTriggerKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (!open) openMenu()
    requestAnimationFrame(() => focusItem(event.key === 'ArrowUp' ? -1 : 0))
  }

  /* Tab leaves the menu naturally; close only after focus has already moved
     outside the trigger + popover, so the browser keeps the next stop. */
  const onRootBlur = (event) => {
    if (rootRef.current === null) return
    const next = event.relatedTarget
    if (
      next !== null &&
      typeof next === 'object' &&
      next.nodeType !== undefined &&
      rootRef.current.contains(next)
    ) {
      return
    }
    setOpen(false)
  }

  const runItem = (item) => {
    setOpen(false)
    if (typeof item.onSelect === 'function') item.onSelect(triggerRef.current)
  }

  return h(
    'div',
    {
      className: className === undefined ? 'ar-more' : 'ar-more ' + className,
      ref: rootRef,
      onBlur: onRootBlur,
    },
    h(
      'button',
      {
        type: 'button',
        className: 'ar-more__trigger',
        ref: triggerRef,
        title: label,
        'aria-label': label,
        'aria-haspopup': 'menu',
        'aria-expanded': open ? 'true' : 'false',
        disabled: disabled === true,
        onClick: () => {
          if (open) setOpen(false)
          else openMenu()
        },
        onKeyDown: onTriggerKeyDown,
      },
      h(EllipsisGlyph, { size: 14 }),
    ),
    open
      ? h(
          'div',
          {
            className: 'ar-menu',
            'data-placement': placement,
            role: 'menu',
            'aria-label': label,
            'aria-orientation': 'vertical',
            ref: menuRef,
            onKeyDown: onMenuKeyDown,
          },
          items.map((item, index) =>
            h(
              'button',
              {
                key: item.id === undefined ? String(index) : item.id,
                type: 'button',
                className: 'ar-menu__item',
                role: 'menuitem',
                'data-danger': item.danger === true ? 'true' : undefined,
                onClick: () => runItem(item),
              },
              item.icon === undefined
                ? null
                : h('span', { className: 'ar-menu__icon', 'aria-hidden': 'true' }, item.icon),
              h('span', { className: 'ar-menu__label' }, item.label),
            ),
          ),
        )
      : null,
  )
}

module.exports = { MoreMenu }
