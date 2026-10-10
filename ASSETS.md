# Road to Dawn asset set

## Original audio

`public/assets/audio/rainline-after-hours.mp3` (40 seconds, 96 BPM) and `six-gates-of-steel.mp3` (32 seconds, 120 BPM) are original exploration and boss themes. `score.json` records the synthesis method, musical brief, duration, tempo, and measured levels. Thirteen short combat clips and `effects.json` are under `public/assets/audio/sfx`. The katana swishes use reduced high-frequency noise and short 0.18–0.26-second envelopes; impacts use resonant metal and low body transients. Both audio sets were composed using procedural synthesis with no external recordings. The authoring scripts preserve the complete arrangements and sound designs.

All new PNG artwork was created with the built-in image-generation tool. Selected runtime artwork and exact prompts are saved together below; the editable originals are also retained in `../assets`. Sprite metadata records source rectangles, ground anchors, and a shared body scale.

## Action sheets

| Asset | Selected PNG / metadata / exact prompt |
| --- | --- |
| Samurai: 3 katana cuts, crouch, jump, landing, hurt | `public/assets/characters/samurai/samurai-actions-v1.{png,json,prompt.txt}` |
| Violet raider and red armored enforcer: walk, guard, windup, strike, hurt | `public/assets/characters/enemies/cyber-raiders-v1.{png,json,prompt.txt}` |

Both sheets are 1774 × 887 RGBA with transparent backgrounds. The samurai has sixteen poses; each enemy has eight. Their prompt files preserve the initial art direction and final wider-layout refinement.

## Corrected civilian arms

`public/assets/characters/pedestrians/npc-everyday-walk-v3.{png,json,prompt.txt}` replaces the everyday civilian atlas. In all eight umbrella-commuter frames, the holding hand grips the shaft in front of the chest with a connected, naturally bent arm. The free arm swings beside the coat. The four designs, original leg poses, and calibrated short stride are retained. The exact edit prompt accompanies the transparent 1774 × 887 PNG and measured frame metadata.

## Fifteen new city backgrounds

Every selected background is 1672 × 941 RGB. For each basename below, the PNG and exact `.prompt.txt` are under `public/assets/environments/`.

| District | Asset basename |
| --- | --- |
| Rainline Station | `cyberpunk-station-v1` |
| Capsule Arcade | `cyberpunk-arcade-v1` |
| Botanical Clinic | `cyberpunk-clinic-v1` |
| Machine Row | `cyberpunk-workshops-v1` |
| Under the Overpass | `cyberpunk-overpass-v1` |
| Red Torii Street | `cyberpunk-torii-v1` |
| Crane Harbor | `cyberpunk-docks-v1` |
| Freight Yard | `cyberpunk-freight-v1` |
| The Power Quarter | `cyberpunk-power-v1` |
| Floodgate Avenue | `cyberpunk-floodgate-v1` |
| Hologram Plaza | `cyberpunk-plaza-v1` |
| Garden Towers | `cyberpunk-rooftop-v1` |
| Citadel Approach | `cyberpunk-citadel-v1` |
| Corporate Courtyard | `cyberpunk-courtyard-v1` |
| Dawn Gate | `cyberpunk-dawn-gate-v1` |

Garden Towers and Dawn Gate include `.initial.prompt.txt` for their first composition and `.prompt.txt` for the selected figure-cleanup refinement. The original three city backgrounds, grounded hero walking animation, sixteen civilian designs, and elevated train remain in use.
