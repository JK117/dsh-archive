/**
 * Drag sorting for one parent element. Rendering is delegated to the parent;
 * this component only owns the pointer gesture, the floating ghost, the
 * dashed source placeholder, the insertion preview, and the FLIP transitions
 * that move the neighbours.
 */
const React = require('react')
const { useRef, useEffect, useCallback } = React
const h = React.createElement
const { HOLD_MS, DRAG_TRIGGER_DISTANCE, TOUCH_SCROLL_TOLERANCE } = require('./constants.js')

/**
 * Drag sorting for one parent element.
 *
 * A drag leaves a blank outline in the source slot and inserts a
 * semi-transparent preview in the target slot, so the list itself shows
 * where the element will land. The preview is a real element in the flow:
 * its neighbours are pushed aside, and every push is animated with a FLIP
 * transition. Quick clicks never start a drag.
 */
function Sortable({ ids, axis, disabled, className, onReorder, children, ...rest }) {
  const rootRef = useRef(null);
  const apiRef = useRef(null);
  const suppressClickRef = useRef(false);
  const propsRef = useRef({});
  propsRef.current = {
    ids,
    axis: axis === 'grid' ? 'grid' : 'y',
    disabled: disabled === true,
    onReorder,
  };

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;

    let holdTimer = 0;
    let settleFrame = 0;
    let scrollFrame = 0;
    let finalFrame = 0;
    let suppressTimer = 0;
    let pending = null;
    let active = null;
    let scrollEl = null;
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const panel = () => root.closest('.ar-root');

    const items = () =>
      Array.from(root.querySelectorAll('[data-sort-id]')).filter(
        (element) => element.closest('[data-sort-scope]') === root,
      );

    /** A clone must never be sortable, focusable, or exposed to the reader. */
    const cloneForDrag = (source, mode) => {
      const clone = source.cloneNode(true);
      clone.removeAttribute('data-sort-id');
      clone.style.display = '';
      clone.removeAttribute('aria-expanded');
      clone.removeAttribute('aria-current');
      clone.setAttribute('data-sort-' + mode, 'true');
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      clone.querySelectorAll('[data-sort-id]').forEach((element) => {
        element.removeAttribute('data-sort-id');
      });
      clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
        element.setAttribute('tabindex', '-1');
        if (element.tagName === 'A') element.setAttribute('draggable', 'false');
      });
      return clone;
    };

    /* Real sort units, never the translucent preview or the floating ghost. */
    const realItems = () => {
      if (active === null) return [];
      if (active.kind === 'list') {
        return Array.from(root.children).filter(
          (child) =>
            child.classList.contains('ar-sec') &&
            child.getAttribute('data-sort-preview') !== 'true' &&
            child.getAttribute('data-sort-placeholder') !== 'true',
        );
      }
      return items();
    };

    /* Elements whose boxes should glide when the source leaves or the
       preview changes slot. The source itself is out of the flow. */
    const participants = () => {
      if (active === null) return [];
      const nodes = realItems().filter((node) => node !== active.block);
      if (
        active.preview !== null &&
        active.preview.parentNode === root &&
        !nodes.includes(active.preview)
      ) {
        nodes.push(active.preview);
      }
      return nodes;
    };

    const measure = (nodes) => {
      const rects = new Map();
      for (const node of nodes) {
        if (!node.isConnected) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        rects.set(node, rect);
      }
      return rects;
    };

    const cancelFlips = (nodes) => {
      for (const node of nodes) {
        if (typeof node.getAnimations !== 'function') continue;
        for (const animation of node.getAnimations()) {
          if (typeof animation.id === 'string' && animation.id.indexOf('ar-sort-') === 0) {
            animation.cancel();
          }
        }
      }
    };

    /**
     * FLIP: the new layout is already in place, so animate each moved item
     * from its previous visual box back to zero. Reading the visual box
     * before cancelling old animations also makes interrupted pushes glide
     * instead of snapping.
     */
    const playFlip = (before) => {
      if (reducedMotion || before.size === 0) return;
      for (const [node, oldRect] of before) {
        if (!node.isConnected || typeof node.animate !== 'function') continue;
        const newRect = node.getBoundingClientRect();
        if (newRect.width === 0 && newRect.height === 0) continue;
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        const animation = node.animate(
          [
            { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
            { transform: 'translate(0,0)' },
          ],
          { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' },
        );
        animation.id = 'ar-sort-flip';
      }
    };

    const previewElement = () => {
      if (active === null) return null;
      return cloneForDrag(active.block, 'preview');
    };

    const placePreview = (reference) => {
      if (active === null) return;
      const drag = active;
      if (
        drag.preview !== null &&
        drag.preview.parentNode === root &&
        drag.preview.nextElementSibling === reference
      ) {
        return;
      }
      const nodes = participants();
      const before = measure(nodes);
      cancelFlips(nodes);
      if (drag.preview === null) {
        drag.preview = previewElement();
        if (drag.preview === null) return;
        root.insertBefore(drag.preview, reference);
        if (!reducedMotion && typeof drag.preview.animate === 'function') {
          const fade = drag.preview.animate(
            [{ opacity: 0 }, { opacity: 0.55 }],
            { duration: 140, easing: 'ease-out' },
          );
          fade.id = 'ar-sort-fade';
        }
      } else {
        root.insertBefore(drag.preview, reference);
      }
      playFlip(before);
    };

    const clearPreview = () => {
      if (active === null || active.preview === null) return;
      const nodes = participants();
      const before = measure(nodes);
      cancelFlips(nodes);
      active.preview.remove();
      active.preview = null;
      playFlip(before);
    };

    const findScroller = () => {
      let node = root;
      while (node !== null && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const update = () => {
      if (active === null) return;
      const drag = active;
      if (drag.ghost !== null) {
        drag.ghost.style.left = drag.x - drag.grabX + 'px';
        drag.ghost.style.top = drag.y - drag.grabY + 'px';
      }
      let fillBefore = null;
      if (!drag.sourceLeft) {
        const placeholder = drag.placeholder;
        if (placeholder !== null) {
          const rect = placeholder.getBoundingClientRect();
          const inside =
            drag.x >= rect.left &&
            drag.x <= rect.right &&
            drag.y >= rect.top &&
            drag.y <= rect.bottom;
          if (inside) {
            drag.dropIndex = drag.fromIndex;
            clearPreview();
            return;
          }
        }
        fillBefore = measure(realItems().filter((node) => node !== drag.block));
        if (placeholder !== null) placeholder.remove();
        drag.placeholder = null;
        drag.sourceLeft = true;
      }
      const candidates =
        drag.kind === 'list'
          ? realItems().filter((element) => element !== drag.section)
          : items().filter((element) => element !== drag.item);
      let slotInOthers = candidates.length;
      if (drag.kind === 'list' || drag.axis === 'y') {
        for (let index = 0; index < candidates.length; index += 1) {
          const element =
            drag.kind === 'list'
              ? candidates[index].querySelector('.ar-sec__head') ?? candidates[index]
              : candidates[index];
          const box = element.getBoundingClientRect();
          if (drag.y < box.top + box.height / 2) {
            slotInOthers = index;
            break;
          }
        }
      } else {
        /* Cards form a grid: locate the row under the pointer first,
           then the column inside that row. The preview is excluded from
           the candidates, so its own box never becomes the target. */
        let rowStart = 0;
        while (rowStart < candidates.length) {
          const first = candidates[rowStart].getBoundingClientRect();
          const row = [first];
          let next = rowStart + 1;
          while (next < candidates.length) {
            const box = candidates[next].getBoundingClientRect();
            if (Math.abs(box.top - first.top) > 1) break;
            row.push(box);
            next += 1;
          }
          const rowBottom = row.reduce(
            (bottom, box) => Math.max(bottom, box.bottom),
            first.bottom,
          );
          if (drag.y < first.top) {
            slotInOthers = rowStart;
            break;
          }
          if (drag.y <= rowBottom) {
            let placed = rowStart + row.length;
            for (let column = 0; column < row.length; column += 1) {
              const box = row[column];
              if (drag.x < box.left + box.width / 2) {
                placed = rowStart + column;
                break;
              }
            }
            slotInOthers = placed;
            break;
          }
          rowStart = next;
        }
      }

      const slot =
        slotInOthers <= drag.fromIndex ? slotInOthers : slotInOthers + 1;
      drag.dropIndex = slot;
      if (fillBefore !== null) playFlip(fillBefore);
      /* Also preview the original slot: after the cursor has left the
         source placeholder and comes back, the insertion target must be
         visible just like any other slot. */
      placePreview(
        slotInOthers < candidates.length ? candidates[slotInOthers] : null,
      );
    };

    const scheduleUpdate = () => {
      if (settleFrame !== 0) return;
      settleFrame = window.requestAnimationFrame(() => {
        settleFrame = 0;
        update();
      });
    };

    const scrollTick = () => {
      scrollFrame = 0;
      if (active === null) return;
      if (scrollEl !== null) {
        const box = scrollEl.getBoundingClientRect();
        const edge = Math.min(48, Math.max(18, box.height / 3));
        let delta = 0;
        if (active.y < box.top + edge) {
          delta = -Math.min(18, Math.ceil((box.top + edge - active.y) / 4));
        } else if (active.y > box.bottom - edge) {
          delta = Math.min(18, Math.ceil((active.y - (box.bottom - edge)) / 4));
        }
        /* Cards can only move inside their own list, so never scroll the
           whole column past a list that is already fully on screen. */
        if (delta !== 0 && active.axis === 'grid') {
          const grid = root.getBoundingClientRect();
          if (delta > 0 && grid.bottom <= box.bottom + 1) delta = 0;
          else if (delta < 0 && grid.top >= box.top - 1) delta = 0;
        }
        if (delta !== 0) {
          const before = scrollEl.scrollTop;
          scrollEl.scrollTop = before + delta;
          if (scrollEl.scrollTop !== before) update();
        }
      }
      scrollFrame = window.requestAnimationFrame(scrollTick);
    };

    const finish = (cancelled) => {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
      pending = null;
      if (active === null) return;
      const drag = active;
      const sourceNode = drag.block;
      const finalNodes = realItems();
      const finalBefore = measure(finalNodes.filter((node) => node !== sourceNode));
      const hadPreview = drag.preview !== null;
      const anchor = cancelled
        ? (drag.ghost ?? drag.preview)
        : (drag.preview ?? drag.ghost);
      if (anchor !== null && sourceNode !== null) {
        finalBefore.set(sourceNode, anchor.getBoundingClientRect());
      }
      cancelFlips(finalNodes);
      cancelFlips(participants());
      window.cancelAnimationFrame(settleFrame);
      settleFrame = 0;
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      if (drag.preview !== null) {
        drag.preview.remove();
        drag.preview = null;
      }
      if (drag.ghost !== null) {
        drag.ghost.remove();
        drag.ghost = null;
      }
      if (drag.placeholder !== null) {
        drag.placeholder.remove();
        drag.placeholder = null;
      }
      sourceNode.style.display = drag.originalDisplay;
      if (
        !cancelled &&
        hadPreview &&
        !reducedMotion &&
        typeof sourceNode.animate === 'function'
      ) {
        /* The preview fades into the real element instead of popping. */
        const settle = sourceNode.animate(
          [{ opacity: 0.55 }, { opacity: 1 }],
          { duration: 140, easing: 'ease-out' },
        );
        settle.id = 'ar-sort-settle';
      }
      active = null;
      const rootPanel = panel();
      if (rootPanel !== null) rootPanel.removeAttribute('data-sorting');
      if (
        !cancelled &&
        drag.dropIndex !== drag.fromIndex &&
        drag.dropIndex !== drag.fromIndex + 1
      ) {
        const reorder = propsRef.current.onReorder;
        if (typeof reorder === 'function') reorder(drag.fromIndex, drag.dropIndex);
      }
      if (finalBefore.size > 0 && !reducedMotion) {
        window.cancelAnimationFrame(finalFrame);
        finalFrame = window.requestAnimationFrame(() => {
          finalFrame = 0;
          playFlip(finalBefore);
        });
      }
      /* A click follows pointerup; keep it from toggling a list or opening
         the card that was just dragged. */
      suppressClickRef.current = true;
      window.clearTimeout(suppressTimer);
      /* Touch can deliver its synthetic click noticeably later; a mouse
         click follows pointerup immediately, so a long block would also
         swallow an intentional follow-up click. */
      const clickDelay = drag.pointerType === 'touch' ? 450 : 80;
      suppressTimer = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressTimer = 0;
      }, clickDelay);
    };

    const activate = () => {
      holdTimer = 0;
      if (pending === null || active !== null) return;
      const start = pending;
      pending = null;
      if (propsRef.current.disabled) return;
      const section = start.item.closest('.ar-sec');
      const kind = start.item.classList.contains('ar-card')
        ? 'card'
        : start.item.classList.contains('ar-sec__head')
          ? 'list'
          : 'group';
      const block = kind === 'list' ? section : start.item;
      if (block === null) return;
      const rect = block.getBoundingClientRect();
      const originalDisplay = block.style.display;
      window.cancelAnimationFrame(finalFrame);
      finalFrame = 0;
      active = {
        pointerId: start.pointerId,
        pointerType: start.pointerType,
        item: start.item,
        block,
        fromIndex: start.index,
        axis: propsRef.current.axis,
        kind,
        section,
        originalDisplay,
        ghost: null,
        preview: null,
        placeholder: null,
        sourceLeft: false,
        x: start.startX,
        y: start.startY,
        grabX: start.startX - rect.left,
        grabY: start.startY - rect.top,
        dropIndex: start.index,
      };
      cancelFlips(realItems());
      active.ghost = cloneForDrag(block, 'ghost');
      if (!active.ghost.hasAttribute('data-tone')) {
        const toneHost = block.closest('[data-tone]');
        if (toneHost !== null) {
          active.ghost.setAttribute('data-tone', toneHost.getAttribute('data-tone'));
        }
      }
      active.ghost.style.width = rect.width + 'px';
      active.ghost.style.height = rect.height + 'px';
      active.ghost.style.left = start.startX - active.grabX + 'px';
      active.ghost.style.top = start.startY - active.grabY + 'px';
      const host = panel() ?? document.body;
      host.appendChild(active.ghost);
      if (block.parentNode !== null) {
        active.placeholder = cloneForDrag(block, 'placeholder');
        block.parentNode.insertBefore(active.placeholder, block);
      }
      block.style.display = 'none';
      scrollEl = findScroller();
      const rootPanel = panel();
      if (rootPanel !== null) rootPanel.setAttribute('data-sorting', 'true');
      const selection = window.getSelection();
      if (selection !== null) selection.removeAllRanges();
      update();
      scrollFrame = window.requestAnimationFrame(scrollTick);
    };

    const begin = (event) => {
      if (event.button !== 0 || active !== null) return;
      if (event.pointerType === 'mouse' && event.buttons !== 1) return;
      const props = propsRef.current;
      if (props.disabled || props.ids.length < 2) return;
      const target = event.target;
      const item = target instanceof Element ? target.closest('[data-sort-id]') : null;
      const interactive =
        target instanceof Element
          ? target.closest('button, input, select, textarea, [data-no-drag]')
          : null;
      /* A group row / list head is itself the drag handle; only an action
         nested inside a card (checkbox, trash, confirm buttons) opts out. */
      if (
        interactive !== null &&
        item !== null &&
        interactive !== item &&
        item.contains(interactive)
      ) {
        return;
      }
      if (item === null || item.closest('[data-sort-scope]') !== root) return;
      const sortId = item.getAttribute('data-sort-id');
      const index = sortId === null ? -1 : props.ids.indexOf(sortId);
      if (index === -1) return;
      window.clearTimeout(holdTimer);
      pending = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        item,
        index,
      };
      /* A mouse/pen drag starts on movement, not on a hold; touch waits
         briefly so a vertical swipe can still scroll the rail. */
      if (event.pointerType === 'touch') {
        holdTimer = window.setTimeout(activate, HOLD_MS);
      }
    };

    const onPointerMove = (event) => {
      if (pending !== null && event.pointerId === pending.pointerId) {
        const dx = event.clientX - pending.startX;
        const dy = event.clientY - pending.startY;
        const distance = dx * dx + dy * dy;
        if (pending.pointerType === 'touch') {
          if (distance > TOUCH_SCROLL_TOLERANCE * TOUCH_SCROLL_TOLERANCE) {
            window.clearTimeout(holdTimer);
            holdTimer = 0;
            pending = null;
          }
          return;
        }
        if (distance > DRAG_TRIGGER_DISTANCE * DRAG_TRIGGER_DISTANCE) {
          window.clearTimeout(holdTimer);
          holdTimer = 0;
          activate();
          if (active !== null) {
            active.x = event.clientX;
            active.y = event.clientY;
            if (event.cancelable) event.preventDefault();
            scheduleUpdate();
          }
        }
        return;
      }
      if (active === null || event.pointerId !== active.pointerId) return;
      active.x = event.clientX;
      active.y = event.clientY;
      if (event.cancelable) event.preventDefault();
      scheduleUpdate();
    };

    const onPointerUp = (event) => {
      if (pending !== null && event.pointerId === pending.pointerId) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
        pending = null;
        return;
      }
      if (active !== null && event.pointerId === active.pointerId) finish(false);
    };

    const onPointerCancel = (event) => {
      if (pending !== null && event.pointerId === pending.pointerId) {
        window.clearTimeout(holdTimer);
        holdTimer = 0;
        pending = null;
        return;
      }
      if (active !== null && event.pointerId === active.pointerId) finish(true);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || (pending === null && active === null)) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
      pending = null;
      finish(true);
    };

    const onContextMenu = (event) => {
      if (pending !== null || active !== null) event.preventDefault();
    };

    apiRef.current = { begin };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyDown);
    root.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(suppressTimer);
      window.cancelAnimationFrame(settleFrame);
      window.cancelAnimationFrame(scrollFrame);
      window.cancelAnimationFrame(finalFrame);
      if (active !== null) {
        cancelFlips(realItems());
        if (active.preview !== null) active.preview.remove();
        if (active.ghost !== null) active.ghost.remove();
        if (active.placeholder !== null) active.placeholder.remove();
        active.block.style.display = active.originalDisplay;
        const rootPanel = panel();
        if (rootPanel !== null) rootPanel.removeAttribute('data-sorting');
        active = null;
      }
      pending = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('contextmenu', onContextMenu);
      apiRef.current = null;
      suppressClickRef.current = false;
    };
  }, []);

  const onPointerDown = useCallback((event) => {
    if (apiRef.current !== null) apiRef.current.begin(event);
  }, []);

  return h(
    'div',
    {
      ...rest,
      ref: rootRef,
      className,
      'data-sort-scope': '1',
      onPointerDown,
      onClickCapture: (event) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
      onDragStart: (event) => event.preventDefault(),
    },
    children,
  );
}

module.exports = { Sortable }
