# Vendored copy of `@ccgui/plugin-ui`

Copied from the CC GUI desktop repo (`desktop-cc-gui/packages/plugin-ui`,
MIT © 2026 zhukunpenglinyutong) so this plugin builds from a clean clone: the
package is not published to npm yet and the plugin's `file:` dependency used
to point at a sibling checkout.

The plugin bundles this package into `main.js` / `styles.css` at build time
(see `scripts/build.mjs`); nothing here is fetched at runtime. When
`@ccgui/plugin-ui` changes upstream, copy `src/`, `styles.css` and the
package fields again, then rebuild.
