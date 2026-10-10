import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NPC_ATLASES, HERO_WALK } from '../world.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'environments/cyberpunk-street-v1.png',
  'environments/cyberpunk-market-street-v1.png',
  'environments/cyberpunk-canal-street-v1.png',
  'characters/samurai/samurai-idle-v2-ivory.png',
  `characters/samurai/${HERO_WALK}.png`,
  `characters/samurai/${HERO_WALK}.json`,
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
