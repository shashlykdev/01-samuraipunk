import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'environments/cyberpunk-street-v1.png',
  'environments/cyberpunk-market-street-v1.png',
  'environments/cyberpunk-canal-street-v1.png',
  'characters/samurai/samurai-idle-v2-ivory.png',
  'characters/samurai/samurai-walk-v2-ivory.png',
  'characters/samurai/samurai-walk-v2-ivory.json',
  ...['npc-everyday-walk-v1', 'npc-workers-walk-v1', 'npc-locals-walk-v1', 'npc-nightlife-walk-v1'].flatMap(name => [
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
