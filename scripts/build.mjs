import { copyFile, cp, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISTRICTS, NPC_ATLASES, HERO_WALK, HERO_ACTIONS, ENEMY_ATLAS, ENEMY_SPAWNS } from '../world.js';
import { EFFECT_NAMES } from '../sound-effects.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, 'dist');
const manifest = JSON.parse(await readFile(resolve(project, '.openai/hosting.json'), 'utf8'));
if (manifest.static?.directory !== 'dist') throw new Error('Expected dist static output.');
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'game.js', 'engine.js', 'world.js', 'combat.js', 'mobile.js', 'music.js', 'sound-effects.js']) {
  await copyFile(resolve(project, file), resolve(output, file));
}
await cp(resolve(project, 'public/assets'), resolve(output, 'assets'), { recursive: true });
const hero = JSON.parse(await readFile(resolve(project, `public/assets/characters/samurai/${HERO_WALK}.json`), 'utf8'));
if (hero.frames.length !== 8 || !(hero.cycle_distance > 0)) throw new Error('The samurai needs eight frames and calibrated stride distance.');
const heroPng = await readFile(resolve(output, `assets/characters/samurai/${HERO_WALK}.png`));
const heroWidth = heroPng.readUInt32BE(16), heroHeight = heroPng.readUInt32BE(20);
for (const frame of hero.frames) {
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isInteger) || frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0 || frame.x + frame.width > heroWidth || frame.y + frame.height > heroHeight) {
    throw new Error('Invalid samurai source rectangle.');
  }
}
await stat(resolve(output, 'assets/vehicles/elevated-train-v1.png'));
for (const district of DISTRICTS) await stat(resolve(output, 'assets/environments', district.image));
if (DISTRICTS.length < 18 || new Set(DISTRICTS.map(district => district.image)).size !== DISTRICTS.length) throw new Error('Eighteen distinct city backgrounds are required.');
for (const [folder, name, count] of [['samurai', HERO_ACTIONS, 16], ['enemies', ENEMY_ATLAS, 8]]) {
  const base = resolve(output, 'assets/characters', folder);
  const meta = JSON.parse(await readFile(resolve(base, `${name}.json`), 'utf8'));
  const png = await readFile(resolve(base, `${name}.png`));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  for (const character of meta.characters ?? [meta]) {
    if (character.frames.length !== count || !(character.body_height > 0)) throw new Error(`Invalid action sheet: ${name}`);
    for (const frame of character.frames) {
      if (![frame.x, frame.y, frame.width, frame.height].every(Number.isInteger) || frame.x < 0 || frame.y < 0 || frame.x + frame.width > width || frame.y + frame.height > height) throw new Error(`Invalid action rectangle: ${name}`);
    }
  }
}
if (ENEMY_SPAWNS.filter(enemy => enemy.boss).length !== 6 || ENEMY_SPAWNS.filter(enemy => enemy.finalBoss).length !== 1) throw new Error('Six district bosses and one final commander are required.');
for (const track of ['rainline-after-hours.mp3', 'six-gates-of-steel.mp3', 'score.json']) await stat(resolve(output, 'assets/audio', track));
for (const name of EFFECT_NAMES) await stat(resolve(output, 'assets/audio/sfx', `${name}.mp3`));
const npcIds = new Set();
for (const name of NPC_ATLASES) {
  const folder = resolve(output, 'assets/characters/pedestrians');
  const atlas = JSON.parse(await readFile(resolve(folder, `${name}.json`), 'utf8'));
  const png = await readFile(resolve(folder, `${name}.png`));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  for (const character of atlas.characters) {
    if (npcIds.has(character.id)) throw new Error(`Duplicate NPC: ${character.id}`);
    npcIds.add(character.id);
    if (character.frames.length !== 8 || !(character.cycle_distance > 0)) throw new Error(`Eight walk frames and calibrated stride required for ${character.id}`);
    for (const frame of character.frames) {
      if (![frame.x, frame.y, frame.width, frame.height].every(Number.isInteger) || frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0 || frame.x + frame.width > width || frame.y + frame.height > height) {
        throw new Error(`Invalid source rectangle for ${character.id}`);
      }
    }
  }
}
if (npcIds.size < 15) throw new Error('At least fifteen distinct NPCs are required.');
console.log(`Built Neon Ronin: ${DISTRICTS.length} districts, ${npcIds.size} NPC designs, six bosses, two music loops and ${EFFECT_NAMES.length} combat effects.`);
