/**
 * The panel stylesheet. Only `--dsw-alias-*` theme tokens are used for
 * surfaces, text, and borders, so light and dark themes stay consistent.
 * Dividers derive their weight from the theme tokens as well; one soft shadow
 * is the only literal colour, matching the other plugin panels.
 */
const CSS = `.ar-root{position:relative;box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding-top:var(--dsh-frame-top-clearance,0px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;--ar-line:var(--dsw-alias-border-l1);--ar-line-strong:var(--dsw-alias-border-l2);--ar-card-lift:3%;--ar-card-lift-hover:6%;--ar-danger:var(--dsw-alias-state-error-primary)}
/* Light surfaces read darker than dark ones at the same mix step, so the light theme lifts much less. The host flags dark mode on <body>. */
body[data-ds-dark-theme] .ar-root{--ar-card-lift:8%;--ar-card-lift-hover:14%}
.ar-root *,.ar-root *::before,.ar-root *::after{box-sizing:border-box}
/* Page header: the plugin name is the page's first-level title. */
.ar-header{flex:none;display:flex;align-items:center;gap:12px;height:50px;padding:0 16px;border-bottom:1px solid var(--ar-line-strong)}
.ar-brand{flex:initial;display:flex;align-items:center;gap:9px;min-width:0}
.ar-brand__glyph{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-brand-primary)}
.ar-brand__name{flex:none;margin:0;font-size:18px;line-height:24px;font-weight:600;letter-spacing:.005em;white-space:nowrap}
.ar-header__spacer{flex:1;min-width:8px}
.ar-search{position:relative;flex:none;display:flex;align-items:center;width:210px;height:28px;border:1px solid var(--ar-line);border-radius:7px;background:var(--dsw-alias-bg-layer-1);transition:border-color .16s ease}
.ar-search:focus-within{border-color:var(--dsw-alias-brand-primary)}
.ar-search__glyph{position:absolute;left:7px;display:inline-flex;color:var(--dsw-alias-label-secondary);pointer-events:none}
.ar-search__input{width:100%;height:100%;padding:0 8px 0 26px;border:0;border-radius:inherit;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
.ar-search__input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.85}
.ar-search__input:disabled{opacity:.6}
.ar-body{display:flex;flex:1;min-height:0}
/* Left rail. Its band header shares one height with the right column's, so both lists start on the same line. */
.ar-side{flex:none;display:flex;flex-direction:column;width:220px;min-height:0;border-right:1px solid var(--ar-line-strong)}
.ar-side__head{flex:none;display:flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-bottom:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.ar-side__list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:1px;padding:6px 8px 10px}
.ar-side__foot{flex:none;display:flex;flex-direction:column;gap:1px;padding:10px 16px 12px;border-top:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums}
.ar-side__foot span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-group{position:relative;display:flex;align-items:center;gap:6px;width:100%;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none;transition:background-color .12s ease,color .12s ease}
.ar-group:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
/* The selected group adds its own hue to the base surface: a tinted fill plus a
   2px accent rail on the left edge, so selection reads at a glance even while
   another row is hovered. */
.ar-group[data-active="true"]{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 12%,var(--dsw-alias-bg-base) 88%);color:var(--dsw-alias-label-primary);font-weight:600}
.ar-group[data-active="true"]:hover{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 18%,var(--dsw-alias-bg-base) 82%)}
.ar-group[data-active="true"]::before{content:"";position:absolute;left:3px;top:7px;bottom:7px;width:2px;border-radius:1px;background:var(--ar-group-ink,var(--dsw-alias-brand-primary))}
.ar-group[data-dim="true"]{opacity:.45}
.ar-group:disabled{cursor:default}
.ar-group:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-group__name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600;color:var(--ar-group-ink,var(--dsw-alias-label-primary))}
.ar-group[data-active="true"] .ar-group__name{font-weight:700}
.ar-group__count{flex:none;font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.85}
.ar-group__sel{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted);font-size:10px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
/* Right column: one band header, then the group's lists. Text sits on the 32px rail used by section titles. */
.ar-main{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;padding:0 0 40px}
.ar-root[data-bar-visible="true"] .ar-main{padding-bottom:90px}
/* A group switch remounts this wrapper (keyed by group id), replaying the entry animation. */
.ar-view{min-height:100%;display:flex;flex-direction:column;animation:ar-view-in .26s cubic-bezier(.2,.7,.2,1) both}
.ar-view[data-dir="up"]{--ar-shift:-6px}
.ar-view[data-dir="down"]{--ar-shift:6px}
.ar-main__head{flex:none;display:flex;align-items:center;gap:12px;height:40px;padding:0 16px 0 32px;border-bottom:1px solid var(--ar-line)}
.ar-main__titles{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.ar-main__title{flex:0 1 auto;min-width:0;margin:0;font-size:16px;line-height:22px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ar-group-ink,var(--dsw-alias-label-primary));outline:none}
.ar-main__meta{flex:none;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.ar-main__actions{flex:none;display:flex;align-items:center;gap:4px}
.ar-main__select[data-active="true"]{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary)}
.ar-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color .14s ease,color .14s ease}
.ar-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-btn:disabled{opacity:.5;cursor:default}
.ar-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-btn--danger{border-color:color-mix(in oklab,var(--ar-danger) 30%,transparent);background:color-mix(in oklab,var(--ar-danger) 10%,transparent);color:var(--ar-danger)}
.ar-btn--danger:hover{background:color-mix(in oklab,var(--ar-danger) 16%,transparent);color:var(--ar-danger)}
.ar-btn--primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}
.ar-btn--primary:hover{background:color-mix(in oklab,var(--dsw-alias-brand-primary) 86%,var(--dsw-alias-label-primary) 14%);color:var(--dsw-alias-label-primary-inverted)}
.ar-sections{flex:1 0 auto;display:flex;flex-direction:column;padding:6px 0 0}
.ar-sections>.ar-sec{border-top:1px solid var(--ar-line)}
.ar-sections>.ar-sec:first-child{border-top:0}
.ar-sec__head{position:relative;display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 16px 0 32px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none}
button.ar-sec__head:hover{background:var(--dsw-alias-bg-layer-2)}
.ar-sec__head[data-static="true"]{cursor:default}
button.ar-sec__head:disabled{cursor:default}
button.ar-sec__head:disabled:hover{background:transparent}
.ar-sec__head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-sec__chev{flex:none;display:inline-flex;align-items:center;color:var(--ar-list-ink-soft,var(--dsw-alias-label-secondary));transition:transform .16s ease}
.ar-sec[data-open="true"] .ar-sec__chev{transform:rotate(90deg)}
.ar-sec__title{flex:0 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--ar-list-ink,var(--dsw-alias-label-primary))}
.ar-sec__count{flex:none;margin-left:auto;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* The card body stays mounted and animates its row from 0fr to 1fr, so both open and close have a height transition; visibility keeps collapsed cards out of the tab order. */
.ar-sec__body{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s linear .24s}
.ar-sec[data-open="true"] .ar-sec__body{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s}
.ar-sec__inner{min-height:0;overflow:hidden}
.ar-sec__empty{padding:8px 16px 12px 32px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
/* One candy hue per group, cycling. The group title takes the saturated ink, its lists take a
   desaturated ink of the same hue, so colour alone shows the parent/child relation. OKLCH fixes the
   perceived lightness across hues; mixing with the theme's primary label keeps both themes readable. */
.ar-root [data-tone]{--ar-hue:240;--ar-group-ink:color-mix(in oklab,oklch(0.74 0.21 var(--ar-hue)) 70%,var(--dsw-alias-label-primary));--ar-list-ink:color-mix(in oklab,oklch(0.76 0.11 var(--ar-hue)) 70%,var(--dsw-alias-label-primary));--ar-list-ink-soft:color-mix(in oklab,oklch(0.76 0.11 var(--ar-hue)) 50%,var(--dsw-alias-label-secondary))}
.ar-root [data-tone="0"]{--ar-hue:20}
.ar-root [data-tone="1"]{--ar-hue:45}
.ar-root [data-tone="2"]{--ar-hue:75}
.ar-root [data-tone="3"]{--ar-hue:150}
.ar-root [data-tone="4"]{--ar-hue:195}
.ar-root [data-tone="5"]{--ar-hue:240}
.ar-root [data-tone="6"]{--ar-hue:285}
.ar-root [data-tone="7"]{--ar-hue:330}
.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:10px;padding:6px 16px 12px 32px}
.ar-sec[data-open="true"] .ar-grid{animation:ar-fade-in .2s ease both}
.ar-sec:not([data-open="true"]) .ar-grid{opacity:0;transition:opacity .18s ease}
/* The card is a positioning context: a transparent full-card anchor carries the
   native link behaviour, while the checkbox / trash / confirm layer sit above it
   as real buttons. Buttons must never be nested inside the anchor. */
.ar-card{position:relative;display:flex;align-items:center;gap:9px;min-width:0;min-height:76px;padding:11px 34px 11px 12px;border:.5px solid var(--ar-line);border-radius:10px;background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift)),var(--dsw-alias-label-primary) var(--ar-card-lift));color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;user-select:none;-webkit-touch-callout:none;-webkit-user-drag:none;transition:border-color .16s ease,background-color .16s ease}
/* Card surface = the sidebar fill nudged a fixed step towards the theme's text colour, so any theme (even one whose fill equals its base) keeps a visible card/background delta. Tune it with the --ar-card-lift variables on .ar-root. */
.ar-card:hover{border-color:var(--dsw-alias-border-l2);background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift-hover)),var(--dsw-alias-label-primary) var(--ar-card-lift-hover))}
.ar-card[data-selected="true"]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 9%,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) 91%)}
.ar-card[data-selected="true"]:hover{border-color:var(--dsw-alias-brand-primary);background:color-mix(in oklab,var(--dsw-alias-brand-primary) 13%,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) 87%)}
.ar-card__link{position:absolute;inset:0;z-index:0;display:block;border-radius:inherit;text-decoration:none}
.ar-card__link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-card[data-confirming="true"] .ar-card__link{pointer-events:none}
.ar-card__lead{position:relative;z-index:1;flex:none;width:18px;height:18px;pointer-events:none}
.ar-card__title{position:relative;z-index:1;min-width:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;pointer-events:none}
.ar-fav{flex:none;width:18px;height:18px;border-radius:4px;object-fit:contain;transition:opacity .12s ease}
.ar-fav--letter{display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;line-height:1}
.ar-card:hover .ar-fav,.ar-card__link:focus-visible ~ .ar-card__lead .ar-fav,.ar-card[data-selected="true"] .ar-fav{opacity:0}
.ar-card__check{position:absolute;inset:0;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:1.5px solid var(--dsw-alias-label-tertiary);border-radius:4px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary-inverted);cursor:pointer;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,visibility 0s linear .12s,border-color .12s ease,background-color .12s ease}
.ar-card:hover .ar-card__check,.ar-card__link:focus-visible ~ .ar-card__lead .ar-card__check,.ar-card__check:focus-visible,.ar-card[data-selected="true"] .ar-card__check{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .12s ease,visibility 0s,border-color .12s ease,background-color .12s ease}
/* Selection mode only changes what a click does. Unselected cards keep their
   favicon and stay visually identical to the browsing state; their box appears
   on hover or keyboard focus, while selected cards keep the checked box. The
   idle box keeps its visibility so Tab can still reach it — the keyboard
   focus rule above then reveals it. */
.ar-card[data-selecting="true"] .ar-card__check{visibility:visible}
.ar-card__check:hover{border-color:var(--dsw-alias-brand-primary)}
.ar-card__check[data-checked="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}
.ar-card__check:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-card__check:disabled{cursor:default}
/* Dim a disabled box only where it is actually revealed; a bare :disabled
   opacity would otherwise paint every idle box during a save. */
.ar-card:hover .ar-card__check:disabled,.ar-card[data-selected="true"] .ar-card__check:disabled{opacity:.6}
/* Unchecking with the pointer puts the box away at once, even while the
   pointer still rests on the card; leaving and hovering again brings it back.
   Keyboard focus still wins, so a focused box never hides from the keyboard. */
.ar-card[data-suppress-check="true"]:hover .ar-card__check:not(:focus-visible){opacity:0;pointer-events:none}
.ar-card[data-suppress-check="true"]:hover .ar-fav{opacity:1}
.ar-card__trash{position:absolute;top:50%;right:4px;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--ar-danger);cursor:pointer;opacity:0;pointer-events:none;transform:translateY(-50%);transition:opacity .12s ease,background-color .12s ease}
.ar-card:hover .ar-card__trash,.ar-card:focus-within .ar-card__trash{opacity:1;pointer-events:auto}
.ar-card__trash:hover{background:color-mix(in oklab,var(--ar-danger) 14%,transparent)}
.ar-card__trash:focus-visible{outline:2px solid var(--ar-danger);outline-offset:0}
.ar-card__trash:disabled{cursor:default;opacity:.35}
.ar-card[data-selecting="true"] .ar-card__trash,.ar-card[data-confirming="true"] .ar-card__trash{display:none}
.ar-card__confirm{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:4px;padding:6px 8px;border-radius:inherit;background:color-mix(in oklab,var(--dsw-alias-bg-base) 94%,var(--ar-danger) 6%);transform-origin:right center;animation:ar-confirm-in .2s cubic-bezier(.2,.7,.2,1) both}
.ar-card__confirm-text{flex:none;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11.5px;font-weight:600;line-height:16px;color:var(--ar-danger);text-align:center}
.ar-card__confirm-actions{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0}
/* Cancel plays the entrance in reverse: back towards the trash on the right. */
.ar-card__confirm[data-leaving="true"]{animation:ar-confirm-out .16s cubic-bezier(.4,0,.6,1) both}
.ar-card__confirm-btn{flex:none;height:22px;padding:0 6px;border:1px solid var(--ar-line-strong);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:20px;cursor:pointer;white-space:nowrap}
.ar-card__confirm-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-card__confirm-btn--danger{border-color:color-mix(in oklab,var(--ar-danger) 30%,transparent);background:color-mix(in oklab,var(--ar-danger) 12%,transparent);color:var(--ar-danger)}
.ar-card__confirm-btn--danger:hover{background:color-mix(in oklab,var(--ar-danger) 18%,transparent);color:var(--ar-danger)}
.ar-card__confirm-btn:disabled{opacity:.55;cursor:default}
.ar-card__confirm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
/* Drag feedback: the source keeps a dashed blank box until the pointer leaves
   it; then the box collapses, siblings glide into the gap, a floating copy
   follows the pointer, and a translucent copy previews the target slot. */
[data-sort-placeholder="true"]{pointer-events:none!important;background:transparent!important;border-color:transparent!important;box-shadow:none!important;outline:1px dashed color-mix(in oklab,var(--dsw-alias-label-secondary) 50%,transparent);outline-offset:-1px}
[data-sort-placeholder="true"]>*{visibility:hidden!important}
[data-sort-placeholder="true"] .ar-grid{animation:none!important}
[data-sort-preview="true"]{opacity:.55;pointer-events:none!important;box-shadow:none!important;filter:saturate(.9);transition:none!important}
[data-sort-preview="true"] .ar-grid,[data-sort-ghost="true"] .ar-grid{animation:none!important}
[data-sort-preview="true"] .ar-sec__body,[data-sort-ghost="true"] .ar-sec__body{transition:none!important}
[data-sort-ghost="true"]{position:fixed!important;z-index:1300;margin:0!important;pointer-events:none!important;opacity:.98;box-shadow:0 18px 44px rgba(0,0,0,.28);transition:none!important;will-change:left,top}
.ar-group[data-sort-ghost="true"],.ar-sec[data-sort-ghost="true"]{background:var(--dsw-alias-bg-base)}
.ar-root[data-sorting="true"],.ar-root[data-sorting="true"] *{cursor:grabbing!important;user-select:none!important}
.ar-state{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 24px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.ar-state__title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}
.ar-state__hint{max-width:420px;font-size:12.5px;line-height:18px}
.ar-toast{position:fixed;z-index:1400;left:50%;bottom:26px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 48px));padding:7px 14px;border:1px solid var(--ar-line);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 28px rgba(0,0,0,.2)}
.ar-root[data-select-mode="true"] .ar-toast,.ar-root[data-dialog-open="true"] .ar-toast{opacity:0;pointer-events:none}
/* Floating bulk-action dock: the summary stacks above the bar. The dock itself
   is click-through so the area beside the pill stays usable. */
.ar-bar-dock{position:absolute;z-index:1100;left:220px;right:0;bottom:16px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
.ar-bar{pointer-events:auto;display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);height:44px;padding:0 8px 0 14px;border:1px solid var(--ar-line-strong);border-radius:999px;background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 32px rgba(0,0,0,.22);animation:ar-bar-in .18s cubic-bezier(.2,.7,.2,1) both}
.ar-bar__count{min-width:0;max-width:56%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:28px;cursor:pointer;font-variant-numeric:tabular-nums}
.ar-bar__count:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-bar__count:disabled{cursor:default;opacity:.7}
.ar-bar__actions{display:flex;align-items:center;gap:2px}
.ar-bar__btn{height:28px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}
.ar-bar__btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-bar__btn--danger{color:var(--ar-danger)}
.ar-bar__btn--danger:hover{background:color-mix(in oklab,var(--ar-danger) 12%,transparent);color:var(--ar-danger)}
.ar-bar__btn:disabled{opacity:.45;cursor:default;background:transparent}
.ar-bar__btn:focus-visible,.ar-bar__count:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-summary{pointer-events:auto;width:min(440px,calc(100% - 32px));max-height:320px;display:flex;flex-direction:column;border:1px solid var(--ar-line-strong);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 44px rgba(0,0,0,.28);overflow:hidden;outline:none;animation:ar-bar-in .16s cubic-bezier(.2,.7,.2,1) both}
.ar-summary__head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-bottom:1px solid var(--ar-line);font-size:12px;font-weight:600}
.ar-summary__clear{padding:2px 6px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer}
.ar-summary__clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-summary__body{min-height:0;overflow-y:auto;padding:4px 0}
.ar-summary__group{padding:4px 0}
.ar-summary__group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:4px 12px;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer}
.ar-summary__group-head:hover{background:var(--dsw-alias-bg-layer-2)}
.ar-summary__group-count{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500}
.ar-summary__list{padding:1px 12px 3px 20px}
.ar-summary__list-head{padding:2px 0;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500}
.ar-summary__item{display:flex;align-items:center;gap:6px;padding:2px 0}
.ar-summary__item-title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;color:var(--dsw-alias-label-primary)}
.ar-summary__remove{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.ar-summary__remove:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-summary__remove:focus-visible,.ar-summary__clear:focus-visible,.ar-summary__group-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-summary__foot{flex:none;display:flex;justify-content:flex-end;padding:6px 10px;border-top:1px solid var(--ar-line)}
/* Modal shell shares the panel's token language; the scrim covers only the
   archive panel, not the host shell around it. */
.ar-modal{position:absolute;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.35));animation:ar-fade-in .16s ease both}
.ar-modal__panel{width:min(420px,100%);max-height:calc(100% - 24px);overflow-y:auto;padding:16px;border:1px solid var(--ar-line-strong);border-radius:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:0 24px 60px rgba(0,0,0,.32);animation:ar-modal-in .16s cubic-bezier(.2,.7,.2,1) both}
.ar-modal__title{font-size:14px;line-height:20px;font-weight:600;letter-spacing:-.005em}
/* Delete dialogs tint their heading and warning with the same red as every other delete affordance. */
.ar-modal__panel[data-tone="danger"] .ar-modal__title,.ar-modal__panel[data-tone="danger"] .ar-modal__note{color:var(--ar-danger)}
.ar-modal__body{margin-top:10px}
.ar-modal__note{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.ar-modal__hint{display:flex;flex-direction:column;gap:2px;margin-top:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.ar-modal__hint-soft{color:var(--dsw-alias-label-tertiary);font-size:11px}
.ar-modal__error{margin-top:10px;color:var(--ar-danger);font-size:12px;line-height:17px}
.ar-modal__actions{display:flex;justify-content:flex-end;gap:6px;margin-top:16px}
.ar-pick-list{list-style:none;max-height:180px;overflow-y:auto;margin:8px 0 0;padding:0;border-top:1px solid var(--ar-line)}
.ar-pick-list__row{display:flex;flex-direction:column;gap:1px;padding:6px 0;border-bottom:1px solid var(--ar-line)}
.ar-pick-list__path{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:15px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-pick-list__title{font-size:12px;line-height:17px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-pick-list__more{color:var(--dsw-alias-label-secondary);font-size:11.5px}
.ar-form__field{display:block;margin-bottom:12px}
.ar-form__label{display:block;margin-bottom:4px;color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.01em}
.ar-form__select{width:100%;height:30px;padding:0 6px;border:1px solid var(--ar-line);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}
.ar-form__select:focus{border-color:var(--dsw-alias-brand-primary)}
.ar-form__select:disabled{opacity:.6}
@keyframes ar-fade-in{from{opacity:0}}
@keyframes ar-confirm-in{from{opacity:0;transform:translateX(10px) scale(.96)}}
@keyframes ar-confirm-out{to{opacity:0;transform:translateX(10px) scale(.96)}}
@keyframes ar-view-in{from{opacity:0;transform:translateY(var(--ar-shift,6px))}}
@keyframes ar-bar-in{from{opacity:0;transform:translateY(8px)}}
@keyframes ar-modal-in{from{opacity:0;transform:translateY(4px) scale(.985)}}
.ar-toast{animation:ar-fade-in .16s ease both}
@media (max-width:720px){.ar-bar-dock{left:0}.ar-modal{padding:12px}.ar-modal__panel{width:100%}}
@media (prefers-reduced-motion:reduce){.ar-toast,.ar-view,.ar-sec__body,.ar-sec__chev,.ar-grid,.ar-card,.ar-card__check,.ar-card__trash,.ar-card__confirm,.ar-card__confirm[data-leaving="true"],.ar-bar,.ar-summary,.ar-modal,.ar-modal__panel{animation:none;transition:none}}`

module.exports = { CSS }
