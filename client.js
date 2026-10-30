/**
 * Archive (资料库) — browser half.
 *
 * A root-scoped `main` panel selected by the sidebar's `sidebar.panellist`
 * row. The panel is a two-column library: the narrow left column lists the
 * bookmark groups (first level), and the wide right column lists that group's
 * folders as collapsible sections (second level) whose expanded body is a grid
 * of bookmark cards. A card opens its page in the system browser through the
 * Host's `/dsh-archive/open` route, because a `target="_blank"` anchor would
 * only open another frame of the Web GUI.
 *
 * The page owns no Session: it is a global panel, so the native Conversation
 * stays one click away through the sidebar.
 */
window.__ModuleLoader__.load({
  id: 'dsh-archive',
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useCallback, useRef } = React;

    /** Locale namespace owned by this plugin. */
    const NS = 'dsh-archive';
    /** Panel id: the sidebar row and the `main` cell share it. */
    const PANEL_ID = 'archive';
    const DATA_URL = '/dsh-archive/bookmarks';
    const OPEN_URL = '/dsh-archive/open';
    /** Remembers the selected group and which folders the reader collapsed. */
    const STATE_KEY = 'dsh-archive:state:v1';

    /** Simplified Chinese dictionary (the key-set source of truth). */
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
      'status.errorHint': '请检查插件目录下的 data/bookmarks.json 是否存在且为有效的导出文件。',
      retry: '重试',
      'open.failed': '无法在系统浏览器中打开这个链接',
    };

    /** English dictionary, checked complete against the zh key set. */
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
      'status.errorHint': 'Check that data/bookmarks.json exists in the plugin directory and is a valid export.',
      retry: 'Retry',
      'open.failed': 'Could not open this link in your browser',
    };

    /**
     * Only `--dsw-alias-*` theme tokens are used for surfaces, text, and
     * borders, so light and dark themes stay consistent. Spacing and type
     * sizes follow the shipped panel/settings pages; a soft shadow is the one
     * literal value, as in the other plugin panels.
     */
    const CSS = `
.ar-root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding-top:var(--dsh-frame-top-clearance,0px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.ar-root *,.ar-root *::before,.ar-root *::after{box-sizing:border-box}
.ar-header{flex:none;display:flex;align-items:center;gap:10px;height:50px;padding:0 14px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.ar-brand{flex:initial;display:flex;align-items:center;gap:8px;min-width:0;max-width:52%}
.ar-brand__glyph{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-brand-primary)}
.ar-brand__name{flex:none;font-size:14px;font-weight:600;letter-spacing:.01em}
.ar-brand__divider{flex:none;width:1px;height:12px;margin:0 4px;background:var(--dsw-alias-border-l1)}
.ar-brand__meta{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.ar-header__spacer{flex:1;min-width:8px}
.ar-search{position:relative;flex:none;display:flex;align-items:center;width:200px;height:28px;border:.5px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);transition:border-color .16s ease}
.ar-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.ar-search__glyph{position:absolute;left:7px;display:inline-flex;color:var(--dsw-alias-label-secondary);pointer-events:none}
.ar-search__input{width:100%;height:100%;padding:0 8px 0 26px;border:0;border-radius:inherit;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
.ar-search__input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.ar-body{display:flex;flex:1;min-height:0}
.ar-side{flex:none;display:flex;flex-direction:column;width:220px;min-height:0;border-right:.5px solid var(--dsw-alias-border-l1)}
.ar-side__head{flex:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 14px;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.ar-side__count{margin-left:auto;font-size:11.5px;font-weight:500;letter-spacing:0;font-variant-numeric:tabular-nums}
.ar-side__list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:1px;padding:2px 8px 16px}
.ar-group{display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:30px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer;transition:background-color .12s ease,color .12s ease}
.ar-group:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-group[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}
.ar-group[data-dim="true"]{opacity:.45}
.ar-group:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-group__name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-group__count{flex:none;font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.85}
.ar-main{flex:1;min-width:0;min-height:0;overflow-y:auto;padding:18px 24px 44px}
.ar-main__head{display:flex;align-items:flex-start;gap:12px}
.ar-main__titles{flex:1;min-width:0}
.ar-main__title{margin:0;font-size:20px;line-height:26px;font-weight:600;letter-spacing:-.01em;overflow-wrap:anywhere}
.ar-main__meta{margin-top:2px;font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.ar-main__actions{flex:none;display:flex;align-items:center;gap:6px;padding-top:2px}
.ar-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color .14s ease,color .14s ease}
.ar-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-sections{display:flex;flex-direction:column}
.ar-sections>.ar-sec{border-top:.5px solid var(--dsw-alias-border-l1);margin-top:12px;padding-top:6px}
.ar-sections>.ar-sec:first-child{border-top:0;margin-top:6px;padding-top:0}
.ar-sec__head{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer}
button.ar-sec__head:hover{background:var(--dsw-alias-bg-layer-2)}
.ar-sec__head[data-static="true"]{cursor:default}
.ar-sec__head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-sec__chev{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary);transition:transform .16s ease}
.ar-sec[data-open="true"] .ar-sec__chev{transform:rotate(90deg)}
.ar-sec__title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-sec__count{flex:none;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:10px;padding:7px 0 3px}
.ar-card{display:flex;align-items:flex-start;gap:9px;min-width:0;padding:11px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;text-decoration:none;transition:border-color .16s ease,background-color .16s ease}
.ar-card:hover{border-color:var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,var(--dsw-alias-bg-layer-1))}
.ar-card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-card__title{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ar-fav{flex:none;width:18px;height:18px;border-radius:4px;object-fit:contain}
.ar-fav--letter{display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;line-height:1}
.ar-state{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 24px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.ar-state__title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}
.ar-state__hint{max-width:420px;font-size:12.5px;line-height:18px}
.ar-toast{position:fixed;z-index:1200;left:50%;bottom:26px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 48px));padding:7px 14px;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 28px rgba(0,0,0,.2)}
@keyframes ar-fade-in{from{opacity:0}}
.ar-toast{animation:ar-fade-in .16s ease both}
@media (prefers-reduced-motion:reduce){.ar-toast,.ar-sec__chev,.ar-card{animation:none;transition:none}}
`;

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
      );
    }

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
      );
    }

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
      );
    }

    /** The single letter a favicon-less bookmark shows in its 18px tile. */
    function letterFor(card) {
      try {
        const host = new URL(card.url).hostname.replace(/^www\./i, '');
        if (host) return host.charAt(0).toUpperCase();
      } catch {
        // A malformed URL never reaches here (the Host filters it), but the
        // fallback keeps the card rendered instead of throwing.
      }
      const title = typeof card.title === 'string' ? card.title.trim() : '';
      return title ? title.charAt(0).toUpperCase() : '?';
    }

    /**
     * A bookmark's favicon. Many exported `favIconUrl` values are long dead,
     * so a broken image degrades to a letter tile instead of an empty box.
     */
    function Favicon({ card }) {
      const [failed, setFailed] = useState(false);
      const usable = typeof card.icon === 'string' && card.icon !== '' && !failed;
      if (!usable) {
        return h(
          'span',
          { className: 'ar-fav ar-fav--letter', 'aria-hidden': 'true' },
          letterFor(card),
        );
      }
      return h('img', {
        className: 'ar-fav',
        src: card.icon,
        alt: '',
        width: 18,
        height: 18,
        loading: 'lazy',
        referrerPolicy: 'no-referrer',
        draggable: false,
        onError: () => setFailed(true),
      });
    }

    /**
     * One bookmark. It stays a real anchor so hover shows the destination and
     * the context menu can copy it; a plain left click is intercepted and sent
     * to the Host, which hands the URL to the system browser. Modified clicks
     * keep the browser's own new-tab behavior.
     */
    function BookmarkCard({ card, onOpen }) {
      return h(
        'a',
        {
          className: 'ar-card',
          href: card.url,
          target: '_blank',
          rel: 'noreferrer',
          title: card.title + '\n' + card.url,
          onClick: (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onOpen(card.url);
          },
        },
        h(Favicon, { card }),
        h('span', { className: 'ar-card__title' }, card.title),
      );
    }

    /** A second-level folder: its header toggles a grid of bookmark cards. */
    function ListSection({ list, open, collapsible, onToggle, onOpen }) {
      const inner = [
        h(Chevron, { key: 'chev', open }),
        h('span', { key: 'title', className: 'ar-sec__title' }, list.title),
        h('span', { key: 'count', className: 'ar-sec__count' }, list.count),
      ];
      const head = collapsible
        ? h(
            'button',
            {
              type: 'button',
              className: 'ar-sec__head',
              'aria-expanded': open ? 'true' : 'false',
              onClick: onToggle,
            },
            inner,
          )
        : h('div', { className: 'ar-sec__head', 'data-static': 'true' }, inner);

      return h(
        'section',
        {
          className: 'ar-sec',
          'data-open': open ? 'true' : 'false',
          'aria-label': list.title,
        },
        head,
        open
          ? h(
              'div',
              { className: 'ar-grid' },
              list.cards.map((card) =>
                h(BookmarkCard, { key: card.id, card, onOpen }),
              ),
            )
          : null,
      );
    }

    function GroupRow({ group, count, active, dim, onClick }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'ar-group',
          'data-active': active ? 'true' : 'false',
          'data-dim': dim ? 'true' : 'false',
          'aria-current': active ? 'true' : undefined,
          title: group.name,
          onClick,
        },
        h('span', { className: 'ar-group__name' }, group.name),
        h('span', { className: 'ar-group__count' }, count),
      );
    }

    /** Reads the remembered selection; a broken value simply starts fresh. */
    function readSavedState() {
      try {
        const raw = window.localStorage.getItem(STATE_KEY);
        if (raw === null) return { groupId: null, expanded: {} };
        const parsed = JSON.parse(raw);
        const expanded =
          parsed !== null && typeof parsed === 'object' && typeof parsed.expanded === 'object' && parsed.expanded !== null
            ? parsed.expanded
            : {};
        return {
          groupId: typeof parsed?.groupId === 'string' ? parsed.groupId : null,
          expanded,
        };
      } catch {
        return { groupId: null, expanded: {} };
      }
    }

    function writeSavedState(state) {
      try {
        window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch {
        // A full quota or a private-mode window only costs the memory of the
        // last selection, which is not worth failing the page over.
      }
    }

    function matchesQuery(card, query) {
      return (
        card.title.toLowerCase().includes(query) ||
        card.url.toLowerCase().includes(query)
      );
    }

    /**
     * The Archive page.
     *
     * @param props - the slot's locale-injected `t` seat.
     * @returns the full two-column library, or a loading/error placeholder.
     */
    function Panel(props) {
      const t = props.t;
      const [status, setStatus] = useState('loading');
      const [collection, setCollection] = useState(null);
      const [activeGroupId, setActiveGroupId] = useState(null);
      const [expanded, setExpanded] = useState({});
      const [query, setQuery] = useState('');
      const [toast, setToast] = useState(null);
      const [attempt, setAttempt] = useState(0);
      const mainRef = useRef(null);
      const mountedRef = useRef(true);

      useEffect(() => {
        mountedRef.current = true;
        return () => {
          mountedRef.current = false;
        };
      }, []);

      useEffect(() => {
        const controller = new AbortController();
        let live = true;
        setStatus('loading');
        const run = async () => {
          try {
            const response = await fetch(DATA_URL, {
              signal: controller.signal,
              headers: { accept: 'application/json' },
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const payload = await response.json();
            if (!live) return;
            const groups = Array.isArray(payload?.groups) ? payload.groups : [];
            if (groups.length === 0) throw new Error('empty-collection');
            const saved = readSavedState();
            const preferred =
              (saved.groupId && groups.some((group) => group.id === saved.groupId)
                ? saved.groupId
                : null) ?? groups[0].id;
            setCollection(payload);
            setActiveGroupId(preferred);
            setExpanded(saved.expanded);
            setStatus('ready');
          } catch (error) {
            if (!live || error?.name === 'AbortError') return;
            setStatus('error');
          }
        };
        void run();
        return () => {
          live = false;
          controller.abort();
        };
      }, [attempt]);

      useEffect(() => {
        if (status !== 'ready') return;
        writeSavedState({ groupId: activeGroupId, expanded });
      }, [status, activeGroupId, expanded]);

      useEffect(() => {
        if (toast === null) return undefined;
        const timer = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(timer);
      }, [toast]);

      useEffect(() => {
        if (mainRef.current !== null) mainRef.current.scrollTop = 0;
      }, [activeGroupId]);

      const groups = collection?.groups ?? [];
      const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;
      const queryText = query.trim().toLowerCase();

      const visibleLists = useMemo(() => {
        if (activeGroup === null) return [];
        if (queryText === '') return activeGroup.lists;
        const filtered = [];
        for (const list of activeGroup.lists) {
          const cards = list.cards.filter((card) => matchesQuery(card, queryText));
          if (cards.length > 0) filtered.push({ ...list, cards, count: cards.length });
        }
        return filtered;
      }, [activeGroup, queryText]);

      const groupMatches = useMemo(() => {
        if (queryText === '') return null;
        const counts = new Map();
        for (const group of groups) {
          let total = 0;
          for (const list of group.lists) {
            for (const card of list.cards) {
              if (matchesQuery(card, queryText)) total += 1;
            }
          }
          counts.set(group.id, total);
        }
        return counts;
      }, [groups, queryText]);

      const openBookmark = useCallback(
        (url) => {
          void (async () => {
            try {
              const response = await fetch(OPEN_URL, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url }),
              });
              if (!response.ok) throw new Error('HTTP ' + response.status);
            } catch {
              if (mountedRef.current) setToast(t('open.failed'));
            }
          })();
        },
        [t],
      );

      const toggleList = useCallback((listId) => {
        setExpanded((current) => {
          const open = current[listId] !== false;
          return { ...current, [listId]: !open };
        });
      }, []);

      const expandAll = useCallback(() => setExpanded({}), []);
      const collapseAll = useCallback(() => {
        if (activeGroup === null) return;
        const next = {};
        for (const list of activeGroup.lists) next[list.id] = false;
        setExpanded(next);
      }, [activeGroup]);

      const stats = collection?.stats ?? { groups: 0, lists: 0, bookmarks: 0 };

      const header = h(
        'header',
        { className: 'ar-header', key: 'header' },
        h(
          'div',
          { className: 'ar-brand' },
          h('span', { className: 'ar-brand__glyph' }, h(ArchiveGlyph, { size: 18 })),
          h('span', { className: 'ar-brand__name' }, t('title')),
          status === 'ready'
            ? [
                h('span', { className: 'ar-brand__divider', key: 'divider' }),
                h(
                  'span',
                  { className: 'ar-brand__meta', key: 'meta' },
                  [
                    t('count.groups', { n: stats.groups }),
                    t('count.lists', { n: stats.lists }),
                    t('count.bookmarks', { n: stats.bookmarks }),
                  ].join(' · '),
                ),
              ]
            : null,
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
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
      );

      if (status === 'loading') {
        return h(
          'div',
          { className: 'ar-root' },
          h('style', { key: 'styles' }, CSS),
          header,
          h('div', { className: 'ar-state' }, t('status.loading')),
        );
      }

      if (status === 'error') {
        return h(
          'div',
          { className: 'ar-root' },
          h('style', { key: 'styles' }, CSS),
          header,
          h(
            'div',
            { className: 'ar-state' },
            h('div', { className: 'ar-state__title' }, t('status.error')),
            h('div', { className: 'ar-state__hint' }, t('status.errorHint')),
            h(
              'button',
              {
                type: 'button',
                className: 'ar-btn',
                style: { borderColor: 'var(--dsw-alias-border-l2)' },
                onClick: () => setAttempt((value) => value + 1),
              },
              t('retry'),
            ),
          ),
        );
      }

      const side = h(
        'aside',
        { className: 'ar-side', key: 'side' },
        h(
          'div',
          { className: 'ar-side__head' },
          h('span', null, t('groups')),
          h('span', { className: 'ar-side__count' }, groups.length),
        ),
        h(
          'div',
          { className: 'ar-side__list', 'aria-label': t('groups') },
          groups.map((group) =>
            h(GroupRow, {
              key: group.id,
              group,
              count: groupMatches === null ? group.count : groupMatches.get(group.id) ?? 0,
              active: activeGroup !== null && group.id === activeGroup.id,
              dim: groupMatches !== null && (groupMatches.get(group.id) ?? 0) === 0,
              onClick: () => setActiveGroupId(group.id),
            }),
          ),
        ),
      );

      const mainChildren = [];

      if (activeGroup !== null) {
        mainChildren.push(
          h(
            'div',
            { className: 'ar-main__head', key: 'head' },
            h(
              'div',
              { className: 'ar-main__titles' },
              h('h1', { className: 'ar-main__title' }, activeGroup.name),
              h(
                'div',
                { className: 'ar-main__meta' },
                queryText === ''
                  ? [
                      t('count.lists', { n: activeGroup.lists.length }),
                      t('count.bookmarks', { n: activeGroup.count }),
                    ].join(' · ')
                  : t('count.match', {
                      n: visibleLists.reduce((total, list) => total + list.count, 0),
                    }),
              ),
            ),
            queryText === ''
              ? h(
                  'div',
                  { className: 'ar-main__actions' },
                  h(
                    'button',
                    { type: 'button', className: 'ar-btn', onClick: expandAll },
                    t('expandAll'),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'ar-btn', onClick: collapseAll },
                    t('collapseAll'),
                  ),
                )
              : null,
          ),
        );

        if (visibleLists.length === 0) {
          mainChildren.push(
            h(
              'div',
              { className: 'ar-state', key: 'empty' },
              h(
                'div',
                { className: 'ar-state__title' },
                queryText === '' ? t('status.empty') : t('status.noMatch', { q: query.trim() }),
              ),
            ),
          );
        } else {
          mainChildren.push(
            h(
              'div',
              { className: 'ar-sections', key: 'sections' },
              visibleLists.map((list) => {
                const open = queryText === '' ? expanded[list.id] !== false : true;
                return h(ListSection, {
                  key: list.id,
                  list,
                  open,
                  collapsible: queryText === '',
                  onToggle: () => toggleList(list.id),
                  onOpen: openBookmark,
                });
              }),
            ),
          );
        }
      }

      const main = h(
        'div',
        { className: 'ar-main', key: 'main', ref: mainRef },
        mainChildren,
      );

      return h(
        'div',
        { className: 'ar-root' },
        h('style', { key: 'styles' }, CSS),
        header,
        h('div', { className: 'ar-body' }, side, main),
        toast === null ? null : h('div', { className: 'ar-toast', role: 'status' }, toast),
      );
    }

    /** The sidebar row: a 20px glyph that thickens while its panel is open. */
    function PanelIcon({ size, active }) {
      return h(ArchiveGlyph, { size, strokeWidth: active ? 1.9 : 1.7 });
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-archive: dictionaries');

      const t = ctx.locale.bind(NS);
      const PanelEntry = (props) => h(Panel, { ...props, t: props.t || t });

      ctx.effect(
        () =>
          ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, PanelEntry),
          ),
        'dsh-archive: main panel',
      );

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: PANEL_ID,
                order: 30,
                label: () => t('title'),
                locale: NS,
              },
              PanelIcon,
            ),
          ),
        'dsh-archive: sidebar entry',
      );
    }

    exports.apply = apply;
    exports.inject = ['slots', 'locale'];
    return module.exports;
  },
});
