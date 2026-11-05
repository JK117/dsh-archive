/**
 * Client entry: registers the locale dictionaries, the `main` panel, and the
 * `sidebar.panellist` row. All rendering lives in `panel.js` and below, so
 * this file stays a small composition root.
 */
const React = require('react')
const h = React.createElement
const { NS, PANEL_ID } = require('./constants.js')
const { zh, en } = require('./i18n.js')
const { Panel } = require('./panel.js')
const { PanelIcon } = require('./glyphs.js')

function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-archive: dictionaries')

  const t = ctx.locale.bind(NS)
  const PanelEntry = (props) => h(Panel, { ...props, t: props.t || t })

  ctx.effect(
    () =>
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, PanelEntry),
      ),
    'dsh-archive: main panel',
  )

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
  )
}

module.exports = { apply, inject: ['slots', 'locale'] }
