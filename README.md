# Neon Ronin — Road to Dawn

A browser samurai action game across eighteen connected cyberpunk districts. Fifteen new illustrated streets extend the original lantern district, night market, and canal promenade. Fight raiders and armored enforcers, chain katana attacks, and defeat the commander at Dawn Gate. Sixteen civilian designs populate the sidewalks, with thirteen late-night stops to discover.

## Run locally

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:8766. No package installation is required.

## Controls

- A / D or arrow keys: walk left and right.
- Shift: quicker walk.
- Space / W / Up: jump.
- J / X or left mouse click: swing the katana. Tap during a strike to queue the next cut in the three-attack combo. Jump + J attacks in the air.
- K: dodge. A dodge costs 30 stamina; stamina regenerates. Hold a movement direction to choose the dodge direction.
- M: open the city map. Travel is available when nearby enemies have been cleared.
- E: explore a nearby storefront.
- Escape: pause or leave a storefront.
- Touch movement, jump, katana, and dodge controls are available on narrow screens and touch devices.
- Sound is optional and starts muted.

## Combat and recovery

The samurai has 100 health. Draw Cut, Return Cut, and Storm Break form a three-stage combo, with increasing damage and reach. Consecutive hits build a hit counter and score multiplier. Enemy windups are marked with a red warning; jump or dodge to avoid the strike. Armored enforcers can finish committed attacks through light cuts, while Storm Break interrupts them.

There are 36 enemies, including the Dawn Gate commander. Every third defeat drops a healing pickup worth 18 health. Reaching a new district unlocks a checkpoint and restores health once. Your first rest at each storefront during a run restores 25 health. On defeat, retry from the current checkpoint with full health and stamina; defeated enemies and score are retained for that run. Defeating the commander clears the objective and allows continued exploration.

Discovered stops are saved in browser storage, including discoveries from earlier versions. Combat progress, health, score, and checkpoints last for the current session. Start a new night from Pause to reset the run and discoveries. Gameplay works when browser storage is unavailable. Rain, steam, and camera shake respect reduced-motion preferences.

The map contains eighteen distinct backgrounds, loaded around the current district as you travel. Distant decoded backgrounds are released to limit memory use. The route indicator tracks your position across the full city.

## Artwork

The editable source artwork, image-generation prompts, and animation metadata are in the parent `assets` directory. The game's selected runtime copies are under `public/assets`. Run `npm run sync-assets` after changes to the parent artwork, then rebuild. See [ASSETS.md](ASSETS.md) for the new combat sheets and fifteen new backgrounds, with exact saved prompts. All new raster artwork was generated with the built-in image-generation tool.

Sprite sheets use explicit source rectangles and ground anchors so unequal generated frame widths keep a consistent character scale. The samurai and sixteen individual NPC designs each have eight walk frames, including contact and passing poses. Animation advances with distance traveled, using measured strides. Contact shadows sit under planted boots. The 54 civilian placements are opaque, walk at 26–36 world pixels per second, and use lanes 94–118 pixels above the samurai's feet. The samurai walks at 80 (135 while holding Shift), with a shorter stride and low foot lift.

The new samurai action atlas contains sixteen poses for three katana cuts, crouching, jumping, landing, and taking damage. The two enemy designs each have eight walk/combat poses. Action sheets use a shared body scale so a raised sword or crouch does not resize the character. Original generated PNGs remain intact. The train uses the source crop recorded in its metadata.

## Checks

```sh
npm test
npm run build
```

The 22 automated checks cover movement, map bounds, jump/landing, combo buffering and damage, facing and reach, dodge stamina/invulnerability, armored counterattacks, death, and enemy spawns. Browser QA also covers all fifteen new district routes, keyboard fights, the commander objective, recovery, and phone controls.
