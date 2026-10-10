import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISTRICTS, NPC_ATLASES, HERO_WALK, HERO_ACTIONS, ENEMY_ATLAS } from '../world.js';
import { EFFECT_NAMES } from '../sound-effects.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'environments/city-join-column-v1.png', 'environments/city-join-column-v1.prompt.txt',
  'audio/rainline-after-hours.mp3', 'audio/six-gates-of-steel.mp3', 'audio/score.json', 'audio/sfx/effects.json',
  ...EFFECT_NAMES.map(name => `audio/sfx/${name}.mp3`),
  ...DISTRICTS.flatMap(district => [`environments/${district.image}`, `environments/${district.image.replace('.png', '.prompt.txt')}`]),
  'environments/cyberpunk-rooftop-v1.initial.prompt.txt', 'environments/cyberpunk-dawn-gate-v1.initial.prompt.txt',
  'characters/samurai/samurai-idle-v2-ivory.png',
  'characters/pedestrians/npc-everyday-walk-v3.prompt.txt',
  `characters/samurai/${HERO_WALK}.png`,
  `characters/samurai/${HERO_WALK}.json`,
  `characters/samurai/${HERO_ACTIONS}.png`, `characters/samurai/${HERO_ACTIONS}.json`,
  `characters/samurai/${HERO_ACTIONS}.prompt.txt`,
  `characters/enemies/${ENEMY_ATLAS}.png`, `characters/enemies/${ENEMY_ATLAS}.json`,
  `characters/enemies/${ENEMY_ATLAS}.prompt.txt`,
  ...NPC_ATLASES.flatMap(name => [
    `characters/pedestrians/${name}.png`, `characters/pedestrians/${name}.json`
  ]),
  'vehicles/elevated-train-v1.png',
  'vehicles/elevated-train-v1.json'
];
for (const file of files) {
  const destination = resolve(project, 'public/assets', file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(project, '../assets', file), destination);
}
console.log(`Synced ${files.length} game assets.`);
