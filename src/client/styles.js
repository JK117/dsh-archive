/**
 * The panel stylesheet. Only `--dsw-alias-*` theme tokens are used for
 * surfaces, text, and borders, so light and dark themes stay consistent.
 * Dividers derive their weight from the theme tokens as well; one soft shadow
 * is the only literal colour, matching the other plugin panels.
 */
const CSS = `.ar-root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;padding-top:var(--dsh-frame-top-clearance,0px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;--ar-line:var(--dsw-alias-border-l1);--ar-line-strong:var(--dsw-alias-border-l2);--ar-card-lift:3%;--ar-card-lift-hover:6%}
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
.ar-body{display:flex;flex:1;min-height:0}
/* Left rail. Its band header shares one height with the right column's, so both lists start on the same line. */
.ar-side{flex:none;display:flex;flex-direction:column;width:220px;min-height:0;border-right:1px solid var(--ar-line-strong)}
.ar-side__head{flex:none;display:flex;align-items:center;gap:6px;height:40px;padding:0 16px;border-bottom:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.ar-side__list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:1px;padding:6px 8px 10px}
.ar-side__foot{flex:none;display:flex;flex-direction:column;gap:1px;padding:10px 16px 12px;border-top:1px solid var(--ar-line);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px;font-variant-numeric:tabular-nums}
.ar-side__foot span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ar-group{position:relative;display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none;transition:background-color .12s ease,color .12s ease}
.ar-group:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
/* The selected group adds its own hue to the base surface: a tinted fill plus a
   2px accent rail on the left edge, so selection reads at a glance even while
   another row is hovered. */
.ar-group[data-active="true"]{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 12%,var(--dsw-alias-bg-base) 88%);color:var(--dsw-alias-label-primary);font-weight:600}
.ar-group[data-active="true"]:hover{background:color-mix(in oklab,var(--ar-group-ink,var(--dsw-alias-brand-primary)) 18%,var(--dsw-alias-bg-base) 82%)}
.ar-group[data-active="true"]::before{content:"";position:absolute;left:3px;top:7px;bottom:7px;width:2px;border-radius:1px;background:var(--ar-group-ink,var(--dsw-alias-brand-primary))}
.ar-group[data-dim="true"]{opacity:.45}
.ar-group:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-group__name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600;color:var(--ar-group-ink,var(--dsw-alias-label-primary))}
.ar-group[data-active="true"] .ar-group__name{font-weight:700}
.ar-group__count{flex:none;font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.85}
/* Right column: one band header, then the group's lists. Text sits on the 44px rail used by section titles. */
.ar-main{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;padding:0 0 40px}
/* A group switch remounts this wrapper (keyed by group id), replaying the entry animation. */
.ar-view{animation:ar-view-in .26s cubic-bezier(.2,.7,.2,1) both}
.ar-view[data-dir="up"]{--ar-shift:-6px}
.ar-view[data-dir="down"]{--ar-shift:6px}
.ar-main__head{display:flex;align-items:center;gap:12px;height:40px;padding:0 16px 0 44px;border-bottom:1px solid var(--ar-line)}
.ar-main__titles{flex:1;min-width:0;display:flex;align-items:center;gap:8px}
.ar-main__title{flex:0 1 auto;min-width:0;margin:0;font-size:16px;line-height:22px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ar-group-ink,var(--dsw-alias-label-primary))}
.ar-main__meta{flex:none;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.ar-main__actions{flex:none;display:flex;align-items:center;gap:4px}
.ar-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;transition:background-color .14s ease,color .14s ease}
.ar-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ar-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ar-sections{display:flex;flex-direction:column;padding:6px 0 0}
.ar-sections>.ar-sec{border-top:1px solid var(--ar-line)}
.ar-sections>.ar-sec:first-child{border-top:0}
.ar-sec__head{position:relative;display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 16px 0 24px;border:0;border-radius:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer;user-select:none;-webkit-touch-callout:none}
button.ar-sec__head:hover{background:var(--dsw-alias-bg-layer-2)}
.ar-sec__head[data-static="true"]{cursor:default}
.ar-sec__head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.ar-sec__chev{flex:none;display:inline-flex;align-items:center;color:var(--ar-list-ink-soft,var(--dsw-alias-label-secondary));transition:transform .16s ease}
.ar-sec[data-open="true"] .ar-sec__chev{transform:rotate(90deg)}
.ar-sec__title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--ar-list-ink,var(--dsw-alias-label-primary))}
.ar-sec__count{flex:none;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* The card body stays mounted and animates its row from 0fr to 1fr, so both open and close have a height transition; visibility keeps collapsed cards out of the tab order. */
.ar-sec__body{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s linear .24s}
.ar-sec[data-open="true"] .ar-sec__body{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .24s cubic-bezier(.2,.7,.2,1),visibility 0s}
.ar-sec__inner{min-height:0;overflow:hidden}
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
.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:10px;padding:6px 16px 12px 44px}
.ar-sec[data-open="true"] .ar-grid{animation:ar-fade-in .2s ease both}
.ar-sec:not([data-open="true"]) .ar-grid{opacity:0;transition:opacity .18s ease}
.ar-card{position:relative;display:flex;align-items:flex-start;gap:9px;min-width:0;padding:11px 12px;border:.5px solid var(--ar-line);border-radius:10px;background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift)),var(--dsw-alias-label-primary) var(--ar-card-lift));color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;text-decoration:none;user-select:none;-webkit-touch-callout:none;-webkit-user-drag:none;transition:border-color .16s ease,background-color .16s ease}
/* Card surface = the sidebar fill nudged a fixed step towards the theme's text colour, so any theme (even one whose fill equals its base) keeps a visible card/background delta. Tune it with the --ar-card-lift variables on .ar-root. */
.ar-card:hover{border-color:var(--dsw-alias-border-l2);background:color-mix(in oklab,var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base)) calc(100% - var(--ar-card-lift-hover)),var(--dsw-alias-label-primary) var(--ar-card-lift-hover))}
.ar-card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
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
.ar-card__title{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.ar-fav{flex:none;width:18px;height:18px;border-radius:4px;object-fit:contain}
.ar-fav--letter{display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:600;line-height:1}
.ar-state{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 24px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.ar-state__title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}
.ar-state__hint{max-width:420px;font-size:12.5px;line-height:18px}
.ar-toast{position:fixed;z-index:1200;left:50%;bottom:26px;transform:translateX(-50%);max-width:min(560px,calc(100vw - 48px));padding:7px 14px;border:1px solid var(--ar-line);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 28px rgba(0,0,0,.2)}
@keyframes ar-fade-in{from{opacity:0}}
@keyframes ar-view-in{from{opacity:0;transform:translateY(var(--ar-shift,6px))}}
.ar-toast{animation:ar-fade-in .16s ease both}
@media (prefers-reduced-motion:reduce){.ar-toast,.ar-view,.ar-sec__body,.ar-sec__chev,.ar-grid,.ar-card{animation:none;transition:none}}`

module.exports = { CSS }
