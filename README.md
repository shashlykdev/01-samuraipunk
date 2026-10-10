# Neon Ronin

A browser game built around the generated samurai and cyberpunk city artwork. Walk three connected districts: the lantern street, a covered night market, and a canal promenade. Meet sixteen distinct pedestrians, watch the elevated train, and explore seven late-night stops.

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

Discovered stops are saved in browser storage; the original three discoveries survive the expansion. Start a new night from Pause to reset them. Movement and exploration continue to work when browser storage is unavailable. Cosmetic rain and steam respect reduced-motion preferences. The route indicator tracks your position through the three connected backgrounds.

## Artwork

The editable source artwork, image-generation prompts, and animation metadata are in the parent `assets` directory. The game's selected runtime copies are under `public/assets`. Run `npm run sync-assets` after changes to the parent artwork, then rebuild.

Sprite sheets use explicit source rectangles and ground anchors so unequal generated frame widths keep a consistent character scale. Four NPC atlases contain sixteen individual designs with four relaxed, short-stride frames each. All pedestrians are opaque and walk at 26–38 world pixels per second; the slower samurai pace remains 100 (170 while holding Shift). Each NPC appears once across the whole route. Original generated PNGs remain intact. The train uses the source crop recorded in its metadata.

## Checks

```sh
npm test
npm run build
```
