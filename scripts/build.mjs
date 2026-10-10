import { copyFile, cp, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, 'dist');
const manifest = JSON.parse(await readFile(resolve(project, '.openai/hosting.json'), 'utf8'));
if (manifest.static?.directory !== 'dist') throw new Error('Expected dist static output.');
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'game.js', 'engine.js']) {
  await copyFile(resolve(project, file), resolve(output, file));
}
await cp(resolve(project, 'public/assets'), resolve(output, 'assets'), { recursive: true });
const assetCount = JSON.parse(await readFile(resolve(project, 'public/assets/characters/samurai/samurai-walk-v2-ivory.json'), 'utf8')).frames.length;
if (assetCount !== 4) throw new Error('The samurai sheet must have four frames.');
await stat(resolve(output, 'assets/vehicles/elevated-train-v1.png'));
console.log('Built Neon Ronin into dist with all required artwork.');
