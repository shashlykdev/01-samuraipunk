import { clamp, movementAxis, safeDelta, cameraTarget, districtIndex, advanceWalk, npcLane, wrapPedestrian, closestStop, restoreVisits } from './engine.js';
import { BLOCK_WIDTH, DISTRICTS, WORLD, START_X, NPC_ATLASES, HERO_WALK, BOSS_ENCOUNTERS, STOPS as stops } from './world.js';
import { HERO_ACTIONS, ENEMY_ATLAS, ENEMY_SPAWNS } from './world.js';
import { COMBOS, createHero, createEnemy, requestJump, requestAttack, requestDodge, attackFrame, stepCombat, activeBoss, remainingBosses } from './combat.js';
import { createTouchInput, gameViewport } from './mobile.js';
import { Soundtrack } from './music.js';
import { CombatSounds } from './sound-effects.js';
import { CITY_ART, alignCityFrame, createCityJoin } from './city-background.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const keyboardSceneDescription = canvas.getAttribute('aria-label');
const ctx = canvas.getContext('2d', { alpha: false });
const SAVE_KEY = 'neon-ronin-night-stops-v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const touch = createTouchInput();
const touchMedia = matchMedia('(any-pointer: coarse), (max-width: 900px)');
const player = createHero(START_X);
const state = { mode: 'loading', clock: 0, camera: 0, nearest: null, loaded: false, muted: true, elapsed: 0,
  hitstop: 0, shake: 0, district: 0, checkpoint: START_X, checkpointIndex: 0, won: false, traveling: false };
const view = { width: innerWidth, height: innerHeight, worldWidth: 1672, worldHeight: 941, scale: 1, dpr: 1, cameraY: 0 };
const art = {};
const spritePixels = new WeakMap();
let audio = null;
let lastFrame = performance.now();
let lastHud = 0;
let toastTimeout;

let visits;
try { visits = restoreVisits(localStorage.getItem(SAVE_KEY), stops.map(stop => stop.id)); }
catch { visits = new Set(); }

let pedestrians = [];
let enemies = [];
let effects = [];
let pickups = [];
const checkpoints = new Set([0]);
const restedStops = new Set();
const districtLoads = new Map();
const cityJoins = new Map();
const rain = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), depth: .3 + Math.random() * .7 }));

async function loadImage(path) {
  const image = new Image();
  image.src = `./assets/${path}`;
  await image.decode();
  return image;
}
async function loadJson(path) {
  const response = await fetch(`./assets/${path}`);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}
function loadDistrict(index) {
  if (index < 0 || index >= DISTRICTS.length) return Promise.resolve();
  if (art.backgrounds?.[index]) return Promise.resolve(art.backgrounds[index]);
  if (!districtLoads.has(index)) {
    districtLoads.set(index, loadImage(`environments/${DISTRICTS[index].image}`).then(image => {
      const aligned = alignCityFrame(image, DISTRICTS[index]);
      art.backgrounds[index] = aligned; districtLoads.delete(index); return aligned;
    }).catch(error => { districtLoads.delete(index); throw error; }));
  }
  return districtLoads.get(index);
}
function prefetchDistricts(index) {
  for (const next of [index - 1, index, index + 1, index + 2]) loadDistrict(next).catch(() => {});
  // Only a small neighborhood needs decoded bitmaps on mobile.
  for (let next = 0; next < art.backgrounds.length; next++) if (Math.abs(next - index) > 3) art.backgrounds[next] = null;
  for (const boundary of cityJoins.keys()) if (!art.backgrounds[boundary - 1] || !art.backgrounds[boundary]) cityJoins.delete(boundary);
}

// Align the actual opaque heads and feet; transparent padding is never used as a body measurement.
function prepareSprite(image, metadata, type, defaultDirection) {
  if (!spritePixels.has(image)) {
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth; sample.height = image.naturalHeight;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(image, 0, 0);
    spritePixels.set(image, sampleCtx.getImageData(0, 0, sample.width, sample.height).data);
  }
  const data = spritePixels.get(image);
  const width = image.naturalWidth;
  const frames = metadata?.frames ?? [{ x: 0, y: 0, width, height: image.naturalHeight }];
  const prepared = frames.map(frame => {
    let x0 = frame.width, y0 = frame.height, x1 = 0, y1 = 0;
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        if (data[((y + frame.y) * width + frame.x + x) * 4 + 3] > 20) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    }
    const bodyHeight = y1 - y0;
    const bandStart = Math.floor(y0 + bodyHeight * (type === 'commuter' ? .19 : .10));
    const bandEnd = Math.ceil(y0 + bodyHeight * (type === 'commuter' ? .265 : .17));
    let weight = 0, weightedX = 0;
    for (let y = bandStart; y < bandEnd; y++) {
      for (let x = x0; x <= x1; x++) {
        const alpha = data[((y + frame.y) * width + frame.x + x) * 4 + 3];
        if (alpha > 100) { weight += alpha; weightedX += x * alpha; }
      }
    }
    const anchor = frame.anchor ?? { x: (weight ? weightedX / weight : (x0 + x1) / 2) - frame.height * .02 * defaultDirection, y: y1 + 1 };
    const footprints = [];
    let start = null;
    for (let x = x0; x <= x1 + 1; x++) {
      let touches = false;
      for (let y = y1 - Math.max(2, Math.floor(bodyHeight * .018)); y <= y1 && x <= x1; y++) {
        if (data[((y + frame.y) * width + frame.x + x) * 4 + 3] > 120) { touches = true; break; }
      }
      if (touches && start === null) start = x;
      if (!touches && start !== null) {
        if (x - start >= bodyHeight * .025) footprints.push({ x: (start + x) / 2, width: x - start });
        start = null;
      }
    }
    return { ...frame, anchor, footprints, bounds: { x: Math.max(0, x0 - 2), y: Math.max(0, y0 - 2), width: Math.min(frame.width, x1 + 3) - Math.max(0, x0 - 2), height: Math.min(frame.height, y1 + 3) - Math.max(0, y0 - 2) } };
  });
  const visualHeight = Math.max(...prepared.map(frame => frame.bounds.height));
  return { image, frames: prepared, sourceHeight: frames[0].height, visualHeight, cycleDistance: metadata?.cycle_distance ?? visualHeight * .42, defaultDirection };
}

async function loadCity() {
  try {
    art.backgrounds = Array(DISTRICTS.length).fill(null);
    const [, npcAtlases, results] = await Promise.all([
      loadDistrict(0),
      Promise.all(NPC_ATLASES.map(name => Promise.all([
        loadImage(`characters/pedestrians/${name}.png`), loadJson(`characters/pedestrians/${name}.json`)
      ]))),
      Promise.all([
      loadImage('characters/samurai/samurai-idle-v2-ivory.png'),
      loadImage(`characters/samurai/${HERO_WALK}.png`),
      loadJson(`characters/samurai/${HERO_WALK}.json`),
      loadImage('vehicles/elevated-train-v1.png'),
      loadJson('vehicles/elevated-train-v1.json'),
      loadImage(`characters/samurai/${HERO_ACTIONS}.png`), loadJson(`characters/samurai/${HERO_ACTIONS}.json`),
      loadImage(`characters/enemies/${ENEMY_ATLAS}.png`), loadJson(`characters/enemies/${ENEMY_ATLAS}.json`),
      loadImage('environments/city-join-column-v1.png')
      ])
    ]);
    art.idle = prepareSprite(results[0], null, 'hero', 1);
    art.hero = prepareSprite(results[1], results[2], 'hero', 1);
    art.idle.height = 224 * art.idle.sourceHeight / art.idle.visualHeight;
    art.hero.height = 224 * art.hero.sourceHeight / art.hero.visualHeight;
    art.hero.worldCycle = art.hero.cycleDistance * art.hero.height / art.hero.sourceHeight;
    art.actions = prepareSprite(results[5], results[6], 'hero', 1);
    art.actions.height = 224 * art.actions.sourceHeight / results[6].body_height;
    art.actionClips = results[6].animations;
    art.enemies = Object.fromEntries(results[8].characters.map(character => {
      const sprite = prepareSprite(results[7], character, 'person', 1);
      sprite.height = 216 * sprite.sourceHeight / character.body_height;
      sprite.clips = character.animations;
      return [character.id, sprite];
    }));
    enemies = ENEMY_SPAWNS.map(spec => {
      const foe = createEnemy(spec.id, spec.x, spec.type, spec.boss, spec);
      const sprite = art.enemies[foe.type];
      foe.cycleDistance = sprite.cycleDistance * sprite.height / sprite.sourceHeight;
      return foe;
    });
    art.train = results[3];
    art.trainCrop = results[4].suggested_source_rectangle;
    art.cityColumn = results[9];
    const people = npcAtlases.flatMap(([image, metadata]) => metadata.characters.map(character => {
      const umbrella = character.kind === 'umbrella' || /umbrella|commuter/i.test(character.id);
      const sprite = prepareSprite(image, character, umbrella ? 'commuter' : 'person', character.default_direction ?? 1);
      return { id: character.id, sprite, height: (character.visual_height ?? (umbrella ? 250 : 210)) * sprite.sourceHeight / sprite.visualHeight };
    }));
    if (new Set(people.map(person => person.id)).size < 15) throw new Error('The city needs at least fifteen distinct pedestrians.');
    const crowdCount = DISTRICTS.length * 3;
    pedestrians = Array.from({ length: crowdCount }, (_, index) => {
      const person = people[index % people.length];
      const size = .84 + (index % 3) * .025;
      return { ...person, x: (index + .3) / crowdCount * WORLD.width,
        direction: index % 2 ? 1 : -1, speed: 26 + ((index * 5) % 11), phase: index * .79,
        size, ground: npcLane(WORLD.ground, index),
        cycleDistance: person.sprite.cycleDistance * person.height * size / person.sprite.sourceHeight };
    });
    // Opaque bounds and footprints are now recorded; release the large startup pixel buffers.
    for (const image of [results[0], results[1], results[5], results[7], ...npcAtlases.map(([image]) => image)]) spritePixels.delete(image);
    state.loaded = true;
    state.mode = 'welcome';
    resize();
    state.camera = cameraTarget(player.x, view.worldWidth, WORLD.width);
    $('start').disabled = false;
    $('start').textContent = 'Enter the city';
    $('load-status').textContent = touchMedia.matches ? 'Ready. Tap to enter the city.' : 'Ready when you are. Press Enter to begin.';
    updateHud();
  } catch (error) {
    console.error(error);
    $('load-status').textContent = 'The city could not load. Check your connection and try again.';
    $('start').disabled = false;
    $('start').textContent = 'Reload the city';
    $('start').onclick = () => location.reload();
  }
}

function resize() {
  const root = $('game');
  const bounds = root.getBoundingClientRect();
  const style = getComputedStyle(root);
  const layout = gameViewport(bounds.width, bounds.height, touchMedia.matches, parseFloat(style.getPropertyValue('--safe-top')) || 0, parseFloat(style.getPropertyValue('--safe-bottom')) || 0);
  if (root.classList.contains('portrait') !== layout.portrait) releaseControls();
  root.classList.toggle('touch-ui', touchMedia.matches);
  root.classList.toggle('portrait', layout.portrait);
  canvas.setAttribute('aria-label', touchMedia.matches ? 'City scene. Hold the arrow buttons to move and Katana to chain attacks. Tap Jump, Dodge, City map, Pause, or Explore. Rotate for a wider view.' : keyboardSceneDescription);
  canvas.style.position = 'absolute'; canvas.style.top = `${layout.top}px`; canvas.style.height = `${layout.height}px`;
  const rect = canvas.getBoundingClientRect();
  view.width = rect.width; view.height = rect.height;
  view.dpr = Math.min(devicePixelRatio || 1, touchMedia.matches ? 1.5 : 2);
  canvas.width = Math.round(view.width * view.dpr);
  canvas.height = Math.round(view.height * view.dpr);
  view.worldHeight = layout.worldHeight;
  view.scale = view.height / view.worldHeight;
  view.worldWidth = view.width / view.scale;
  view.cameraY = WORLD.ground - view.worldHeight * layout.groundRatio;
  state.camera = clamp(state.camera, 0, Math.max(0, WORLD.width - view.worldWidth));
}
new ResizeObserver(resize).observe($('game'));
touchMedia.addEventListener('change', () => { releaseControls(); resize(); });
window.visualViewport?.addEventListener('resize', resize);

function drawSprite(sprite, phase, x, ground, height, direction = 1) {
  const frame = sprite.frames[Math.floor(phase) % sprite.frames.length];
  const scale = height / sprite.sourceHeight;
  const b = frame.bounds;
  ctx.save();
  ctx.translate(x, ground);
  if (direction !== sprite.defaultDirection) ctx.scale(-1, 1);
  ctx.drawImage(sprite.image, frame.x + b.x, frame.y + b.y, b.width, b.height,
    (b.x - frame.anchor.x) * scale, (b.y - frame.anchor.y) * scale, b.width * scale, b.height * scale);
  ctx.restore();
}
function shadow(x, ground, width, opacity = .20) {
  ctx.fillStyle = `rgba(0,4,13,${opacity})`;
  ctx.beginPath(); ctx.ellipse(x, ground + 2, width, 5, 0, 0, Math.PI * 2); ctx.fill();
}
function footShadows(sprite, phase, x, ground, height, direction) {
  const frame = sprite.frames[Math.floor(phase) % sprite.frames.length];
  const scale = height / sprite.sourceHeight;
  const flip = direction === sprite.defaultDirection ? 1 : -1;
  ctx.fillStyle = 'rgba(0,3,10,.32)';
  for (const foot of frame.footprints) {
    const footX = x + (foot.x - frame.anchor.x) * scale * flip;
    ctx.beginPath(); ctx.ellipse(footX, ground + 1, Math.max(3, foot.width * scale * .53), 2, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawEnemy(foe) {
  if (foe.health <= 0 && foe.deathTime <= 0) return;
  const sprite = art.enemies[foe.type];
  let phase = sprite.clips.guard[0];
  if (foe.mode === 'walk' || foe.mode === 'recover') phase = sprite.clips.walk[Math.floor(foe.phase) % 4];
  if (foe.mode === 'windup' || foe.mode === 'slam') phase = sprite.clips.windup[0];
  if (foe.mode === 'strike') phase = sprite.clips.strike[0];
  if (foe.stun > 0 || foe.health <= 0) phase = sprite.clips.hurt[0];
  const height = sprite.height * (foe.boss ? 1.12 : 1);
  shadow(foe.x, WORLD.ground, 31, .24);
  if (foe.wave) {
    const wave = foe.wave;
    ctx.strokeStyle = '#ffc479'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(wave.x, WORLD.ground - 13, 23, 17, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wave.x - wave.direction * 43, WORLD.ground - 4); ctx.lineTo(wave.x, WORLD.ground - 29); ctx.stroke();
  }
  if (foe.mode === 'slam') {
    const charge = clamp(foe.timer / .85, 0, 1);
    ctx.strokeStyle = `rgba(255,196,121,${.35 + charge * .6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(foe.x, WORLD.ground + 8); ctx.lineTo(foe.x + foe.direction * 590, WORLD.ground + 8); ctx.stroke();
    ctx.fillStyle = '#ffd99a'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('JUMP / DODGE', foe.x, WORLD.ground - 315);
  }
  if (foe.mode === 'windup') {
    const charge = clamp(foe.timer / foe.attackWindup, 0, 1);
    ctx.strokeStyle = `rgba(255,105,103,${.4 + charge * .55})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(foe.x, WORLD.ground + 2, 32 + charge * 15, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(foe.x, WORLD.ground + 7); ctx.lineTo(foe.x + foe.direction * (foe.reach + foe.lungeDistance), WORLD.ground + 7); ctx.stroke();
    ctx.fillStyle = '#ffc493'; ctx.font = 'bold 25px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(foe.comboIndex ? '!!' : '!', foe.x, WORLD.ground - (foe.boss ? 312 : 285));
  }
  ctx.save();
  if (foe.health <= 0) ctx.globalAlpha = foe.deathTime / .45;
  if (foe.flash > .02) ctx.filter = 'brightness(1.65)';
  else if (foe.boss) ctx.filter = `drop-shadow(0 0 ${foe.bossPhase === 2 ? 10 : 5}px ${foe.bossPhase === 2 ? '#ff6b71' : '#ffd08b'})`;
  footShadows(sprite, phase, foe.x, WORLD.ground, height, foe.direction);
  drawSprite(sprite, phase, foe.x, WORLD.ground, height, foe.direction);
  ctx.restore();
  if (foe.mode === 'strike' && foe.health > 0 && foe.timer - foe.attackWindup < .22) {
    ctx.save(); ctx.translate(foe.x, WORLD.ground - 115); ctx.scale(foe.direction, 1);
    ctx.strokeStyle = '#ff7e72'; ctx.lineWidth = 4; ctx.shadowColor = '#e44b51'; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(12, 0, foe.reach - 14, -.85, .65); ctx.stroke(); ctx.restore();
  }
  if (foe.health > 0 && (foe.health < foe.maxHealth || Math.abs(foe.x - player.x) < 420)) {
    const y = WORLD.ground - (foe.boss ? 267 : 239), width = foe.boss ? 100 : 64;
    ctx.fillStyle = '#080b14cc'; ctx.fillRect(foe.x - width / 2, y, width, 5);
    ctx.fillStyle = foe.boss ? '#f1c683' : '#df687b'; ctx.fillRect(foe.x - width / 2, y, width * foe.health / foe.maxHealth, 5);
    ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#f0d9cb';
    ctx.fillText(foe.boss ? foe.bossName : foe.type.toUpperCase(), foe.x, y - 7);
  }
}
function drawHero() {
  let sprite = art.idle, phase = 0;
  if (player.hurt > 0) { sprite = art.actions; phase = art.actionClips.hurt[0]; }
  else if (player.dodge > 0) { sprite = art.actions; phase = art.actionClips.crouch[0]; }
  else if (player.attack) { sprite = art.actions; phase = art.actionClips[COMBOS[player.attack.stage].animation][attackFrame(player.attack)]; }
  else if (player.y > 0) { sprite = art.actions; phase = art.actionClips.jump[0]; }
  else if (player.landing > 0) { sprite = art.actions; phase = art.actionClips.land[0]; }
  else if (player.moving) { sprite = art.hero; phase = player.phase; }
  shadow(player.x, WORLD.ground, Math.max(20, 34 - player.y * .07), .25 - player.y * .0006);
  if (player.dodge > 0) {
    ctx.save(); ctx.globalAlpha = .15;
    drawSprite(sprite, phase, player.x - player.direction * 25, WORLD.ground, sprite.height, player.direction);
    ctx.restore();
  }
  ctx.save();
  if (player.blink > .1 && player.dodge <= 0 && Math.floor(state.clock * 16) % 2) ctx.globalAlpha = .5;
  if (!player.y) footShadows(sprite, phase, player.x, WORLD.ground, sprite.height, player.direction);
  drawSprite(sprite, phase, player.x, WORLD.ground - player.y, sprite.height, player.direction);
  ctx.restore();
  const attack = player.attack;
  if (attack) {
    const move = COMBOS[attack.stage];
    if (attack.time >= move.activeStart && attack.time <= move.activeEnd) {
      const progress = (attack.time - move.activeStart) / (move.activeEnd - move.activeStart);
      ctx.save(); ctx.translate(player.x, WORLD.ground - player.y - 125); ctx.scale(player.direction, 1);
      ctx.globalAlpha = Math.sin(progress * Math.PI) * .85;
      ctx.lineCap = 'round'; ctx.lineWidth = attack.stage === 2 ? 16 : 10;
      ctx.strokeStyle = attack.stage === 2 ? '#f1bc8a' : '#78dbe8';
      const start = attack.stage === 1 ? .7 : -1.05, end = attack.stage === 1 ? -.95 : .75;
      ctx.beginPath(); ctx.arc(0, 0, move.reach * .82, start, end, attack.stage === 1); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff5df'; ctx.stroke(); ctx.restore();
    }
  }
}
function drawCombatEffects() {
  for (const item of pickups) {
    const y = WORLD.ground - 25 + Math.sin(state.clock * 3 + item.x) * 3;
    ctx.fillStyle = '#9bdfcb'; ctx.shadowColor = '#79e0c1'; ctx.shadowBlur = 12;
    ctx.fillRect(item.x - 3, y - 8, 6, 16); ctx.fillRect(item.x - 8, y - 3, 16, 6); ctx.shadowBlur = 0;
  }
  for (const effect of effects) {
    ctx.globalAlpha = clamp(effect.life / effect.maxLife, 0, 1);
    if (effect.text) {
      ctx.textAlign = 'center'; ctx.font = effect.large ? 'bold 18px monospace' : 'bold 13px monospace';
      ctx.fillStyle = effect.color; ctx.fillText(effect.text, effect.x, effect.y);
    } else {
      ctx.strokeStyle = effect.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x - effect.vx * .028, effect.y - effect.vy * .028); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
function combatEvents(events) {
  for (const event of events) {
    if (event.type === 'boss-enter') { showToast(`${event.finalBoss ? 'FINAL BOSS' : 'DISTRICT BOSS'} · ${event.bossName}`); if (!state.muted) audio?.effect('boss-enter'); }
    if (event.type === 'boss-phase') { showToast(`${event.bossName} · Phase II. Watch for longer combos.`); if (!state.muted) audio?.effect('boss-enter', .7); }
    if (event.type === 'boss-slam') { state.shake = .16; if (!state.muted) audio?.effect('boss-slam'); }
    if (event.type === 'enemy-swing' && !state.muted && Math.abs(event.x - player.x) < 650) audio?.effect('katana-return', event.boss ? .8 : .5);
    if (['jump', 'dodge', 'land'].includes(event.type) && !state.muted) audio?.effect(event.type === 'jump' ? 'dodge' : event.type, event.type === 'jump' ? .35 : .6);
    if (event.type === 'hit' || event.type === 'hurt') {
      const y = WORLD.ground - event.y;
      const color = event.type === 'hurt' ? '#f598a4' : event.finisher ? '#ffd291' : '#b2f5f7';
      effects.push({ x: event.x, y: y - 35, vx: 0, vy: -35, life: .75, maxLife: .75, text: String(event.damage), color, large: event.finisher });
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 60 + Math.random() * 120;
        effects.push({ x: event.x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .25, maxLife: .25, color });
      }
      state.hitstop = event.finisher ? .075 : .045; state.shake = event.type === 'hurt' ? .2 : .12;
      if (!state.muted) audio?.effect(event.type === 'hurt' ? 'hurt' : event.finisher ? 'heavy-impact' : event.armored ? 'armor-hit' : 'blade-hit');
    }
    if (event.type === 'swing' && !state.muted) audio?.effect(['katana-draw', 'katana-return', 'katana-finisher'][event.stage], .7);
    if (event.type === 'kill') {
      if (!state.muted) audio?.effect(event.boss ? 'boss-defeat' : 'enemy-fall', event.boss ? 1 : .7);
      if (event.drop) pickups.push({ x: event.x });
      if (event.boss) {
        showToast(`${event.bossName} defeated · +40 vitality · ${remainingBosses(enemies)} bosses remain.`);
      }
      if (event.boss && remainingBosses(enemies) === 0 && !state.won) {
        player.health = Math.max(1, player.health);
        state.won = true; state.mode = 'victory'; releaseControls();
        $('victory-stats').textContent = `${player.kills} enemies defeated · ${player.bestCombo} hit best combo · ${player.score} points`;
        $('victory-dialog').showModal();
        // Let the victory chime finish; do not resume audio if the player muted or left.
        const victoryAudio = audio;
        setTimeout(() => { if (state.mode === 'victory' && audio === victoryAudio) audio?.suspend(); }, 1900);
      }
    }
    if (event.type === 'death' && state.mode !== 'victory') {
      state.mode = 'dead'; releaseControls();
      $('death-copy').textContent = `Return to ${DISTRICTS[state.checkpointIndex].name} with full vitality. Defeated enemies and your score are kept.`;
      $('death-dialog').showModal(); audio?.suspend();
    }
  }
}
function drawTrain() {
  const crop = art.trainCrop;
  const width = 950;
  const height = width * crop.height / crop.width;
  const x = BLOCK_WIDTH + 1000 - ((state.clock * 145 + 1300) % (BLOCK_WIDTH + 2000));
  const rail = 941 * .199 * 1.18;
  ctx.save();
  ctx.beginPath(); ctx.rect(BLOCK_WIDTH * .313, 45, BLOCK_WIDTH * .46, rail - 45); ctx.clip();
  ctx.globalAlpha = .95;
  ctx.drawImage(art.train, crop.x, crop.y, crop.width, crop.height, x, rail - height, width, height);
  ctx.restore();
}
function drawSteam() {
  if (reducedMotion) return;
  const originX = BLOCK_WIDTH * .295;
  const originY = WORLD.ground - 180;
  for (let i = 0; i < 5; i++) {
    const progress = ((state.clock * .18 + i / 5) % 1);
    const x = originX + Math.sin(progress * 4 + i) * 13;
    const y = originY - progress * 65;
    const radius = 9 + progress * 17;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, `rgba(215,213,230,${.07 * (1 - progress)})`);
    cloud.addColorStop(1, 'rgba(215,213,230,0)');
    ctx.fillStyle = cloud; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}
function drawDistricts() {
  for (let index = 0; index < art.backgrounds.length; index++) {
    const x = index * BLOCK_WIDTH;
    if (x + BLOCK_WIDTH < state.camera || x > state.camera + view.worldWidth) continue;
    if (art.backgrounds[index]) ctx.drawImage(art.backgrounds[index], x, 0, BLOCK_WIDTH, WORLD.height);
    else { ctx.fillStyle = '#0b1826'; ctx.fillRect(x, 0, BLOCK_WIDTH, WORLD.height); loadDistrict(index).catch(() => {}); }
  }
  // Cache joined textures only for the currently loaded neighborhood.
  const joinWidth = CITY_ART.joinWidth * BLOCK_WIDTH / CITY_ART.width;
  for (let index = 1; index < DISTRICTS.length; index++) {
    const x = index * BLOCK_WIDTH;
    if (x + joinWidth / 2 < state.camera || x - joinWidth / 2 > state.camera + view.worldWidth) continue;
    if (!art.backgrounds[index - 1] || !art.backgrounds[index]) continue;
    if (!cityJoins.has(index)) cityJoins.set(index, createCityJoin(art.backgrounds[index - 1], art.backgrounds[index], art.cityColumn, index));
    ctx.drawImage(cityJoins.get(index), x - joinWidth / 2, 0, joinWidth, WORLD.height);
  }
}
function drawRain(foreground) {
  if (reducedMotion) return;
  ctx.save();
  ctx.lineWidth = foreground ? .9 : .65;
  ctx.strokeStyle = foreground ? 'rgba(190,211,231,.23)' : 'rgba(177,190,220,.10)';
  ctx.beginPath();
  for (const drop of rain) {
    if ((drop.depth > .65) !== foreground) continue;
    const width = view.worldWidth + 120;
    const x = ((drop.x * width - state.clock * 105 * drop.depth) % width + width) % width - 30;
    const y = ((drop.y * (view.worldHeight + 80) + state.clock * 650 * drop.depth) % (view.worldHeight + 80)) - 40;
    const length = 7 + drop.depth * 15;
    ctx.moveTo(x, y); ctx.lineTo(x - length * .2, y + length);
  }
  ctx.stroke(); ctx.restore();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#080c15'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.loaded) return;
  ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const shake = reducedMotion ? 0 : state.shake;
  const shakeX = Math.sin(state.clock * 133) * shake * 25, shakeY = Math.cos(state.clock * 113) * shake * 13;
  ctx.save(); ctx.translate(-state.camera + shakeX, -view.cameraY + shakeY);
  drawDistricts();
  drawTrain();
  drawSteam();
  ctx.restore();
  drawRain(false);
  ctx.save(); ctx.translate(-state.camera + shakeX, -view.cameraY + shakeY);
  const crowd = [...pedestrians].sort((a, b) => a.ground - b.ground);
  for (const person of crowd) {
    if (person.x < state.camera - 160 || person.x > state.camera + view.worldWidth + 160) continue;
    const height = person.height * person.size;
    shadow(person.x, person.ground, 22 * person.size, .14);
    footShadows(person.sprite, person.phase, person.x, person.ground, height, person.direction);
    drawSprite(person.sprite, person.phase, person.x, person.ground, height, person.direction);
  }
  if (state.mode === 'playing' && state.nearest) {
    const stop = state.nearest;
    ctx.fillStyle = visits.has(stop.id) ? '#aecdc6' : '#f4d193';
    ctx.beginPath(); ctx.arc(stop.x, WORLD.ground - 160, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const foe of enemies) if ((foe.x >= state.camera - 230 && foe.x <= state.camera + view.worldWidth + 230)
    || (foe.wave && foe.wave.x >= state.camera - 50 && foe.wave.x <= state.camera + view.worldWidth + 50)) drawEnemy(foe);
  drawHero();
  drawCombatEffects();
  ctx.restore();
  drawRain(true);
}

function update(dt) {
  if (!state.loaded || !['welcome', 'playing'].includes(state.mode)) return;
  state.clock += dt;
  state.shake = Math.max(0, state.shake - dt);
  for (const effect of effects) { effect.x += effect.vx * dt; effect.y += effect.vy * dt; effect.life -= dt; }
  effects = effects.filter(effect => effect.life > 0);
  for (const person of pedestrians) {
    const moved = person.speed * dt;
    person.x = wrapPedestrian(person.x + person.direction * moved, WORLD.width);
    person.phase = advanceWalk(person.phase, moved, person.cycleDistance, person.sprite.frames.length);
  }
  if (state.mode === 'playing') {
    state.elapsed += dt;
    if (touch.attack) swingKatana();
    const axis = movementAxis(keys.has('KeyA') || keys.has('ArrowLeft') || touch.left, keys.has('KeyD') || keys.has('ArrowRight') || touch.right);
    const simulationDelta = state.hitstop > 0 ? 0 : dt;
    state.hitstop = Math.max(0, state.hitstop - dt);
    combatEvents(stepCombat(player, enemies, simulationDelta, { axis, fast: keys.has('ShiftLeft') || keys.has('ShiftRight'), walkCycle: art.hero.worldCycle }, WORLD.width));
    for (const item of [...pickups]) if (state.mode === 'playing' && Math.abs(item.x - player.x) < 48 && player.y < 60) {
      player.health = Math.min(player.maxHealth, player.health + 18);
      pickups = pickups.filter(pickup => pickup !== item);
      effects.push({ x: player.x, y: WORLD.ground - 240, vx: 0, vy: -25, life: 1, maxLife: 1, text: '+18 VITALITY', color: '#9bdfcb' });
    }
    const district = districtIndex(player.x, BLOCK_WIDTH, DISTRICTS.length);
    if (district !== state.district) {
      state.district = district; prefetchDistricts(district);
      activateCheckpoint(district);
    }
    state.nearest = nearbyThreat(220) ? null : closestStop(player.x, stops);
  } else player.moving = false;
  const target = cameraTarget(player.x, view.worldWidth, WORLD.width);
  state.camera += (target - state.camera) * (1 - Math.exp(-dt * 5));
  if (audio) audio.setTrain(state.clock);
}

function frame(now) {
  const dt = safeDelta((now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  if (now - lastHud > 120) { updateHud(); lastHud = now; }
  requestAnimationFrame(frame);
}

function updateHud() {
  canvas.dataset.state = state.mode;
  canvas.dataset.playerX = player.x.toFixed(1);
  canvas.dataset.cameraX = state.camera.toFixed(1);
  canvas.dataset.visited = String(visits.size);
  const district = districtIndex(player.x, BLOCK_WIDTH, DISTRICTS.length);
  canvas.dataset.district = DISTRICTS[district].id;
  canvas.dataset.npcTypes = String(new Set(pedestrians.map(person => person.id)).size);
  canvas.dataset.npcCount = String(pedestrians.length);
  canvas.dataset.npcIds = [...new Set(pedestrians.map(person => person.id))].join(',');
  canvas.dataset.maxNpcSpeed = String(Math.max(0, ...pedestrians.map(person => person.speed)));
  canvas.dataset.npcGroundGap = String(Math.min(...pedestrians.map(person => WORLD.ground - person.ground)));
  canvas.dataset.heroWalkFrames = String(art.hero?.frames.length ?? 0);
  canvas.dataset.heroCycleDistance = art.hero?.worldCycle.toFixed(1) ?? '0';
  canvas.dataset.health = String(player.health);
  canvas.dataset.heroY = player.y.toFixed(1);
  canvas.dataset.attack = player.attack ? String(player.attack.stage + 1) : '0';
  canvas.dataset.hitCombo = String(player.hitChain);
  canvas.dataset.bestCombo = String(player.bestCombo);
  canvas.dataset.kills = String(player.kills);
  canvas.dataset.enemyCount = String(enemies.length);
  const boss = activeBoss(player, enemies);
  const bossesLeft = remainingBosses(enemies);
  canvas.dataset.bossesRemaining = String(bossesLeft);
  canvas.dataset.activeBoss = boss?.bossName ?? '';
  canvas.dataset.bossPhase = String(boss?.bossPhase ?? 0);
  canvas.dataset.music = state.muted ? 'muted' : audio?.score.mood ?? 'city';
  canvas.dataset.musicReady = String(Boolean(audio?.score.channels));
  canvas.dataset.audioState = audio?.context.state ?? 'off';
  canvas.dataset.sfxReady = String(Boolean(audio?.sfx.buffers));
  canvas.dataset.sectionCount = String(DISTRICTS.length);
  canvas.dataset.touchMode = String(touchMedia.matches);
  canvas.dataset.viewWorldWidth = view.worldWidth.toFixed(1);
  canvas.dataset.touchHeld = ['left', 'right', 'attack'].filter(control => touch.has(control)).join(',');
  canvas.dataset.checkpoint = String(state.checkpointIndex + 1);
  canvas.dataset.nearestEnemyHealth = String(enemies.filter(foe => foe.health > 0).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0]?.health ?? 0);
  $('district-name').textContent = `${String(district + 1).padStart(2, '0')} / ${DISTRICTS[district].name.toUpperCase()}`;
  $('journey-position').style.left = `${player.x / WORLD.width * 100}%`;
  $('journey-route').setAttribute('aria-label', `District ${district + 1} of ${DISTRICTS.length}: ${DISTRICTS[district].name}`);
  $('stop-count').textContent = `${visits.size} / ${stops.length}`;
  $('health').value = player.health; $('health-value').textContent = `${player.health} / ${player.maxHealth}`;
  $('stamina').value = player.stamina;
  $('touch-dodge').classList.toggle('unavailable', player.stamina < 30 || player.dodgeCooldown > 0 || player.y > 0 || player.hurt > 0);
  $('kill-count').textContent = `${player.kills} DEFEATED`; $('score').textContent = String(player.score).padStart(6, '0');
  $('combo').hidden = player.hitChain < 2 && !player.attack;
  $('combo-count').textContent = player.hitChain >= 2 ? `${player.hitChain} HITS` : '';
  $('combo-name').textContent = player.attack ? `${player.attack.stage + 1} / 3 · ${COMBOS[player.attack.stage].name}` : 'KEEP THE RHYTHM';
  $('boss-hud').hidden = !boss || state.mode === 'welcome';
  $('game').classList.toggle('boss-active', Boolean(boss));
  if (boss) {
    $('boss-name').textContent = boss.bossName;
    $('boss-phase').textContent = `${boss.finalBoss ? 'FINAL BOSS' : 'DISTRICT BOSS'} · PHASE ${boss.bossPhase === 2 ? 'II' : 'I'}`;
    $('boss-health').max = boss.maxHealth; $('boss-health').value = boss.health;
    $('boss-health').setAttribute('aria-label', `${boss.bossName} health`);
  }
  $('objective').firstChild.textContent = state.won ? 'DAWN GATE CLEARED' : `${BOSS_ENCOUNTERS.length - bossesLeft} / ${BOSS_ENCOUNTERS.length} BOSSES DEFEATED`;
  $('objective').querySelector('span').textContent = state.won ? 'Keep exploring the city.' : 'Defeat the six district bosses.';
  audio?.score.setMood(boss?.engaged ? 'boss' : 'city');
  const available = state.mode === 'playing' && state.nearest;
  $('game').classList.toggle('can-explore', Boolean(available));
  $('interact').hidden = !available;
  if (available) $('interact-name').textContent = `${state.nearest.name}${visits.has(state.nearest.id) ? ' · revisit' : ''}`;
  $('touch-explore').disabled = !available;
  $('touch-explore').hidden = !available;
}
function nearbyThreat(radius = 380) { return enemies.some(foe => foe.health > 0 && Math.abs(foe.x - player.x) < radius); }
function swingKatana() {
  if (state.mode !== 'playing') return;
  const axis = movementAxis(keys.has('KeyA') || keys.has('ArrowLeft') || touch.left, keys.has('KeyD') || keys.has('ArrowRight') || touch.right);
  if (!player.attack && !axis) {
    const closest = enemies.filter(foe => foe.health > 0 && Math.abs(foe.x - player.x) < 220).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
    if (closest) player.direction = closest.x >= player.x ? 1 : -1;
  }
  requestAttack(player);
}
function activateCheckpoint(index) {
  if (player.health <= 0) return;
  state.checkpoint = BLOCK_WIDTH * index + 165; state.checkpointIndex = index;
  if (!checkpoints.has(index)) {
    checkpoints.add(index); player.health = player.maxHealth;
    showToast(`${DISTRICTS[index].name} · Checkpoint reached. Vitality restored.`);
  }
}
function releaseControls() {
  keys.clear(); touch.clear(); player.moving = false;
  for (const button of $('touch-controls').querySelectorAll('button')) button.classList.remove('pressed');
}
function startWalk() {
  if (!state.loaded || state.mode !== 'welcome') return;
  state.mode = 'playing';
  $('welcome').hidden = true; $('hud').hidden = false; $('walk-hud').hidden = false; $('touch-controls').hidden = false;
  $('combat-hud').hidden = false; $('objective').hidden = false;
  canvas.focus(); updateHud();
  prefetchDistricts(0);
}
function pauseWalk() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused'; releaseControls();
  $('pause-dialog').showModal();
  audio?.suspend(); updateHud();
}
function resumeWalk() {
  $('pause-dialog').close(); state.mode = 'playing'; lastFrame = performance.now();
  if (!state.muted) audio?.resume();
  canvas.focus(); updateHud();
}
function restartWalk() {
  visits.clear(); saveVisits(); Object.assign(player, createHero(START_X));
  enemies = ENEMY_SPAWNS.map(spec => {
    const foe = createEnemy(spec.id, spec.x, spec.type, spec.boss, spec), sprite = art.enemies[spec.type];
    foe.cycleDistance = sprite.cycleDistance * sprite.height / sprite.sourceHeight; return foe;
  });
  effects = []; pickups = []; checkpoints.clear(); checkpoints.add(0); restedStops.clear();
  state.elapsed = 0; state.district = 0; state.checkpoint = START_X; state.checkpointIndex = 0; state.won = false; state.hitstop = 0;
  $('objective').firstChild.textContent = 'REACH DAWN GATE'; $('objective').querySelector('span').textContent = 'Defeat the gate commander.';
  prefetchDistricts(0); state.camera = cameraTarget(player.x, view.worldWidth, WORLD.width);
  resumeWalk(); showToast('A fresh night. The city is yours to explore.');
}
function saveVisits() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify([...visits])); } catch { /* Walking still works when storage is unavailable. */ }
}
function explore() {
  if (state.mode !== 'playing' || !state.nearest) return;
  const stop = state.nearest;
  if (!restedStops.has(stop.id)) { restedStops.add(stop.id); player.health = Math.min(player.maxHealth, player.health + 25); }
  state.mode = 'stop'; releaseControls();
  $('stop-title').textContent = stop.name; $('stop-label').textContent = stop.label;
  $('stop-copy').textContent = stop.copy; $('stop-detail').textContent = stop.detail;
  visits.add(stop.id); saveVisits(); updateHud();
  $('stop-dialog').showModal(); audio?.suspend();
}
function leaveStop() {
  $('stop-dialog').close(); state.mode = 'playing'; lastFrame = performance.now();
  if (!state.muted) audio?.resume();
  canvas.focus(); updateHud();
  if (visits.size === stops.length) showToast('Every corner has a story. Keep walking, or begin a new night from Pause.');
}
function showToast(message) {
  clearTimeout(toastTimeout); $('toast').textContent = message; $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 6500);
}
function openMap() {
  if (state.mode !== 'playing') return;
  const blocked = nearbyThreat();
  state.mode = 'map'; releaseControls(); audio?.suspend();
  $('map-status').textContent = blocked ? 'Enemies are close. Clear the street before traveling.' : 'Travel to any of the 18 districts. New streets unlock recovery checkpoints.';
  $('map-grid').replaceChildren(...DISTRICTS.map((district, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `map-card${index === state.district ? ' current' : ''}`;
    const encounter = BOSS_ENCOUNTERS.find(boss => boss.district === index);
    const cleared = encounter && !enemies.some(foe => foe.boss && foe.health > 0 && foe.id === `${district.id}-enforcer`);
    const small = document.createElement('small'); small.textContent = `${String(index + 1).padStart(2, '0')} / ${encounter ? cleared ? 'BOSS CLEARED' : encounter.bossName : checkpoints.has(index) ? 'CHECKPOINT' : 'CITY SECTION'}`;
    button.append(small, document.createTextNode(district.name)); button.disabled = blocked;
    button.addEventListener('click', () => travelTo(index)); return button;
  }));
  $('map-dialog').showModal(); updateHud();
}
function closeMap() {
  if (state.traveling) return;
  $('map-dialog').close(); state.mode = 'playing'; lastFrame = performance.now();
  if (!state.muted) audio?.resume(); canvas.focus(); updateHud();
}
async function travelTo(index) {
  if (state.traveling || state.mode !== 'map') return;
  state.traveling = true; $('map-status').textContent = `Traveling to ${DISTRICTS[index].name}…`;
  for (const button of $('map-grid').querySelectorAll('button')) button.disabled = true;
  try {
    await Promise.all([loadDistrict(index - 1), loadDistrict(index), loadDistrict(index + 1)]);
    player.x = index === 0 ? START_X : BLOCK_WIDTH * index + 165;
    player.y = 0; player.vy = 0; player.attack = null; player.hurt = 0; player.blink = 0; player.dodge = 0; player.invulnerable = 1;
    state.district = index; activateCheckpoint(index); prefetchDistricts(index);
    state.camera = cameraTarget(player.x, view.worldWidth, WORLD.width);
    state.traveling = false; closeMap();
  } catch { state.traveling = false; $('map-status').textContent = 'This street could not load. Close the map and try again.'; }
}
function retryCheckpoint() {
  $('death-dialog').close();
  player.x = state.checkpoint; player.health = player.maxHealth; player.stamina = 100;
  player.y = 0; player.vy = 0; player.hurt = 0; player.blink = 0; player.attack = null; player.dodge = 0; player.invulnerable = 2;
  player.pendingEvents = []; player.hitChain = 0; player.comboGrace = 0;
  for (const foe of enemies) if (foe.health > 0 && Math.abs(foe.home - state.checkpoint) < BLOCK_WIDTH) {
    Object.assign(foe, createEnemy(foe.id, foe.home, foe.type, foe.boss, foe), { cycleDistance: foe.cycleDistance, cooldown: 1 });
  }
  state.hitstop = 0; state.mode = 'playing'; state.camera = cameraTarget(player.x, view.worldWidth, WORLD.width); lastFrame = performance.now();
  if (!state.muted) audio?.resume(); canvas.focus(); updateHud();
}
function continueCity() {
  $('victory-dialog').close(); state.mode = 'playing'; lastFrame = performance.now();
  if (!state.muted) audio?.resume(); canvas.focus(); updateHud();
}

class CityAudio {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio is not supported in this browser.');
    this.context = new AudioContext();
    const mix = this.context.createDynamicsCompressor();
    mix.threshold.value = -6; mix.knee.value = 8; mix.ratio.value = 3; mix.attack.value = .003; mix.release.value = .18;
    mix.connect(this.context.destination);
    this.score = new Soundtrack(this.context, mix);
    this.sfx = new CombatSounds(this.context, mix);
    const master = this.context.createGain(); master.gain.value = .21; master.connect(mix);
    this.master = master;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .1;
    const noise = this.context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const highpass = this.context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 900;
    const lowpass = this.context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 7000;
    noise.connect(highpass); highpass.connect(lowpass); lowpass.connect(master); noise.start();
    const hum = this.context.createOscillator(); hum.type = 'sine'; hum.frequency.value = 58;
    const humGain = this.context.createGain(); humGain.gain.value = .10; hum.connect(humGain); humGain.connect(master); hum.start();
    const train = this.context.createOscillator(); train.type = 'sine'; train.frequency.value = 112;
    this.trainGain = this.context.createGain(); this.trainGain.gain.value = 0; train.connect(this.trainGain); this.trainGain.connect(master); train.start();
  }
  async resume() { await this.context.resume(); await Promise.all([this.score.start(), this.sfx.load()]); }
  suspend() { return this.context.suspend(); }
  setTrain(clock) {
    const cycle = ((clock * 145 + 1300) % (BLOCK_WIDTH + 2000));
    const presence = Math.max(0, 1 - Math.abs(cycle - 2100) / 900);
    this.trainGain.gain.setTargetAtTime(presence * .09, this.context.currentTime, .2);
  }
  effect(kind, volume = 1) { this.sfx.play(kind, volume); }
}

$('start').addEventListener('click', startWalk);
$('pause').addEventListener('click', pauseWalk);
$('resume').addEventListener('click', resumeWalk);
$('restart').addEventListener('click', restartWalk);
$('map').addEventListener('click', openMap);
$('close-map').addEventListener('click', closeMap);
$('retry').addEventListener('click', retryCheckpoint);
$('continue-city').addEventListener('click', continueCity);
canvas.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse' && event.button === 0 && state.mode === 'playing') { canvas.focus(); swingKatana(); } });
$('interact').addEventListener('click', explore);
$('touch-explore').addEventListener('click', explore);
$('leave-stop').addEventListener('click', leaveStop);
$('pause-dialog').addEventListener('cancel', event => { event.preventDefault(); resumeWalk(); });
$('stop-dialog').addEventListener('cancel', event => { event.preventDefault(); leaveStop(); });
$('map-dialog').addEventListener('cancel', event => { event.preventDefault(); closeMap(); });
$('death-dialog').addEventListener('cancel', event => event.preventDefault());
$('victory-dialog').addEventListener('cancel', event => { event.preventDefault(); continueCity(); });
$('sound').addEventListener('click', async () => {
  $('sound').disabled = true;
  try {
    if (!audio) audio = new CityAudio();
    if (state.muted) { await audio.resume(); state.muted = false; }
    else { await audio.suspend(); state.muted = true; }
    $('sound').textContent = state.muted ? 'Sound off' : 'Sound on';
    $('sound').setAttribute('aria-pressed', String(!state.muted));
  } catch {
    state.muted = true; await audio?.suspend();
    showToast('The soundtrack could not load. Tap Sound off to try again.');
  } finally { $('sound').disabled = false; }
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('game').requestFullscreen();
  } catch { showToast('Fullscreen is unavailable in this browser window.'); }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });
if (!document.fullscreenEnabled) $('fullscreen').hidden = true;
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLButtonElement && ['Enter', 'Space'].includes(event.code)) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
  if (event.code === 'Enter' && state.mode === 'welcome') { startWalk(); return; }
  if (event.code === 'Escape' && state.mode === 'playing') { event.preventDefault(); pauseWalk(); return; }
  if (event.code === 'KeyM' && !event.repeat) { if (state.mode === 'map') closeMap(); else openMap(); return; }
  if (event.code === 'KeyE' && !event.repeat) { explore(); return; }
  if (state.mode === 'playing') {
    if (!event.repeat && ['Space', 'KeyW', 'ArrowUp'].includes(event.code)) { requestJump(player); return; }
    if (!event.repeat && ['KeyJ', 'KeyX'].includes(event.code)) { swingKatana(); return; }
    if (!event.repeat && event.code === 'KeyK') { requestDodge(player, movementAxis(keys.has('KeyA') || touch.left, keys.has('KeyD') || touch.right)); return; }
    keys.add(event.code);
  }
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { releaseControls(); if (state.mode === 'playing') pauseWalk(); });
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (document.hidden) { releaseControls(); audio?.suspend(); if (state.mode === 'playing') pauseWalk(); }
});
for (const [control, id] of [['left', 'left'], ['right', 'right'], ['jump', 'touch-jump'], ['attack', 'touch-attack'], ['dodge', 'touch-dodge']]) {
  const button = $(id);
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (state.mode !== 'playing' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    touch.press(event.pointerId, control); button.setPointerCapture(event.pointerId); button.classList.add('pressed');
    if (control === 'jump') requestJump(player);
    if (control === 'attack') swingKatana();
    if (control === 'dodge') requestDodge(player, movementAxis(touch.left, touch.right));
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, event => {
    touch.release(event.pointerId); button.classList.toggle('pressed', touch.has(control));
  });
}
for (const element of [canvas, $('touch-controls')]) element.addEventListener('contextmenu', event => event.preventDefault());
resize();
requestAnimationFrame(frame);
loadCity();
