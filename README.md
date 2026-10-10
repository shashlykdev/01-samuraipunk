# Neon Ronin — Road to Dawn

A browser samurai action game across eighteen connected cyberpunk districts. Fight raiders, armored enforcers, and six named bosses on the road to Dawn Gate. Sixteen civilian designs populate the sidewalks, with thirteen late-night stops to discover. An original synthwave score shifts from city exploration to boss combat.

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
- On phones and tablets, hold an arrow to move, hold Katana to chain cuts, and tap Jump or Dodge. Movement and combat accept separate fingers at the same time. Portrait mode keeps the playfield above the buttons; landscape gives a wider city view.
- Sound is optional and starts muted.

## Combat and recovery

The samurai has 100 health. Draw Cut, Return Cut, and Storm Break form a three-stage combo, with increasing damage and reach. Consecutive hits build a hit counter and score multiplier. Enemies pursue a normal walk, start attacks from outside the first cut's reach, and lunge into range. Red warnings show their direction and reach. They aim early, then commit, so a late dodge through an attack can make it miss. Jumping also clears melee strikes.

Light cuts deal damage but only briefly stagger an enemy before it gains temporary resolve and counters. Storm Break always breaks that resolve and creates a longer opening. Nearby enemies take turns committing to attacks and backstep during recovery.

There are 36 enemies, including a boss in every third district: Canal Warden, Chrome Reaper, Shrinebreaker, Dynamo Sentinel, Lotus Assassin, and the Gate Commander. Sweep bosses and the commander send golden ground waves after an 0.85-second directional warning; jump or dodge as the wave reaches you. Duelists chain three separately warned cuts. At half health, every boss moves faster and adds one extra cut. Bosses use the existing enemy artwork at a larger scale with a gold or red aura, their own health bar, entrance cue, and map label.

Every third enemy defeat drops a healing pickup worth 18 health. Each boss defeat restores 40 health and full stamina. Reaching a new district unlocks a checkpoint and restores health once. Your first rest at each storefront during a run restores 25 health. On defeat, retry from the current checkpoint with full health and stamina; defeated enemies and score are retained, and surviving nearby bosses return to their first phase. Defeat all six bosses to clear the objective, then continue exploring.

## Original music and fighting sounds

Tap **Sound off** to enable both music and effects. Rainline After Hours is a 40-second, 96 BPM city loop; Six Gates of Steel is a 32-second, 120 BPM boss loop. The score combines dark synthwave bass and pads with pentatonic shamisen-like plucks and taiko-like percussion. Boss proximity crossfades between the two themes. Both loop through decoded Web Audio buffers; audio downloads only after sound is enabled. Pause, maps, storefronts, app interruption, and death suspend playback.

Thirteen original combat clips cover the three katana cuts, ordinary and armored impacts, a heavy finisher, taking damage, dodging, landing, enemy falls, boss entrances, shockwaves, and boss defeats. Sword swishes are short, soft movements of air; metallic impacts use brief resonant tones rather than sustained high-frequency noise. Effects sit above the music, with slight pitch variation and a limiter on simultaneous voices. The master compressor controls overlapping peaks.

All music and combat audio was composed with procedural synthesis, without external samples or recordings. MP3 files and metadata live under `public/assets/audio`. The reproducible authoring scripts are `scripts/generate-music.py` and `scripts/generate-sfx.py`; regeneration requires Python with NumPy/SciPy and FFmpeg. These authoring tools are unnecessary to run or build the game.

Discovered stops are saved in browser storage, including discoveries from earlier versions. Combat progress, health, score, and checkpoints last for the current session. Start a new night from Pause to reset the run and discoveries. Gameplay works when browser storage is unavailable. Rain, steam, and camera shake respect reduced-motion preferences.

The map contains eighteen distinct backgrounds, loaded around the current district as you travel. Distant decoded backgrounds are released to limit memory use. The route indicator tracks your position across the full city.

## Mobile play

Open the published game link in your phone's browser and tap **Enter the city**. No download is required. Both orientations work; turn sideways for a wider view. The layout accounts for notches, the home indicator, and changing browser height. Health, map, pause, exploration, recovery, and combat are available without a keyboard. Controls release on interruption or rotation so movement and attacks cannot remain held accidentally.

Mobile rendering caps canvas resolution at 1.5 device pixels per CSS pixel. Startup loads the first background before adjacent streets, and discards temporary sprite pixel buffers once their animation bounds are prepared. This reduces startup downloads, retained memory, and canvas fill work.

## Artwork

The editable source artwork, image-generation prompts, and animation metadata are in the parent `assets` directory. The game's selected runtime copies are under `public/assets`. Run `npm run sync-assets` after changes to the parent artwork, then rebuild. See [ASSETS.md](ASSETS.md) for the new combat sheets and fifteen new backgrounds, with exact saved prompts. All new raster artwork was generated with the built-in image-generation tool.

Sprite sheets use explicit source rectangles and ground anchors so unequal generated frame widths keep a consistent character scale. The samurai and sixteen individual NPC designs each have eight walk frames, including contact and passing poses. Animation advances with distance traveled, using measured strides. Contact shadows sit under planted boots. The 54 civilian placements are opaque, walk at 26–36 world pixels per second, and use lanes 94–118 pixels above the samurai's feet. The samurai walks at 80 (135 while holding Shift), with a shorter stride and low foot lift.

The new samurai action atlas contains sixteen poses for three katana cuts, crouching, jumping, landing, and taking damage. The two enemy designs each have eight walk/combat poses. Action sheets use a shared body scale so a raised sword or crouch does not resize the character. Original generated PNGs remain intact. The train uses the source crop recorded in its metadata.

## Checks

```sh
npm test
npm run build
```

The 42 automated checks cover movement, map bounds, jump/landing, combos, facing/reach, dodge stamina/invulnerability, coordinated enemy attacks, six boss profiles, shockwave defenses, phase changes and extra cuts, boss recovery, checkpoint recreation, independent touch inputs, portrait/landscape bounds, music loading/crossfades, audio retry, and bounded sound-effect voices. Browser QA covers the city map, boss fights and health bars on phones, enabled audio, and pause/resume.
