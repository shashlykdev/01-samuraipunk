# Neon Ronin

A browser game built around the generated samurai and cyberpunk city artwork. Walk a rainy city block, pass umbrella commuters and delivery couriers, watch the elevated train, and explore three late-night stops.

## Run locally

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:8766. No package installation is required.

## Controls

- A / D or arrow keys: walk left and right.
- Shift: quicker walk.
- E: explore a nearby storefront.
- Escape: pause or leave a storefront.
- Touch controls are available on narrow screens and touch devices.
- Sound is optional and starts muted.

The three discovered stops are saved in browser storage. Start a new night from Pause to reset them. Movement and exploration continue to work when browser storage is unavailable. Cosmetic rain and steam respect reduced-motion preferences.

## Artwork

The editable source artwork, image-generation prompts, and animation metadata are in the parent `assets` directory. The game's selected runtime copies are under `public/assets`. Run `npm run sync-assets` after changes to the parent artwork, then rebuild.

Sprite sheets use explicit source rectangles and ground anchors so unequal generated frame widths keep a consistent character scale. Original generated PNGs remain intact. The train uses the source crop recorded in its metadata.

## Checks

```sh
npm test
npm run build
```
