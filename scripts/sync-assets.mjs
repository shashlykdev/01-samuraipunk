import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISTRICTS, NPC_ATLASES, HERO_WALK, HERO_ACTIONS, ENEMY_ATLAS } from '../world.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  ...DISTRICTS.flatMap(district => [`environments/${district.image}`, `environments/${district.image.replace('.png', '.prompt.txt')}`]),
  'environments/cyberpunk-rooftop-v1.initial.prompt.txt', 'environments/cyberpunk-dawn-gate-v1.initial.prompt.txt',
  'characters/samurai/samurai-idle-v2-ivory.png',
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
