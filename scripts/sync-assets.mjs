import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'environments/cyberpunk-street-v1.png',
  'characters/samurai/samurai-idle-v2-ivory.png',
  'characters/samurai/samurai-walk-v2-ivory.png',
  'characters/samurai/samurai-walk-v2-ivory.json',
  'characters/pedestrians/commuter-umbrella-walk-v1.png',
  'characters/pedestrians/commuter-umbrella-walk-v1.json',
  'characters/pedestrians/courier-walk-v1.png',
  'characters/pedestrians/courier-walk-v1.json',
  'vehicles/elevated-train-v1.png',
  'vehicles/elevated-train-v1.json'
];
for (const file of files) {
  const destination = resolve(project, 'public/assets', file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(project, '../assets', file), destination);
}
console.log(`Synced ${files.length} game assets.`);
