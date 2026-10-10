import { clamp, movementAxis, safeDelta, cameraTarget, districtIndex, advanceWalk, npcLane, movePlayer, wrapPedestrian, closestStop, restoreVisits } from './engine.js';
import { BLOCK_WIDTH, DISTRICTS, WORLD, START_X, NPC_ATLASES, HERO_WALK, STOPS as stops } from './world.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const ctx = canvas.getContext('2d', { alpha: false });
const SAVE_KEY = 'neon-ronin-night-stops-v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const touch = { left: false, right: false };
const player = { x: START_X, direction: 1, phase: 0, moving: false };
const state = { mode: 'loading', clock: 0, camera: 0, nearest: null, loaded: false, muted: true, elapsed: 0 };
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
    const [backgrounds, npcAtlases, results] = await Promise.all([
      Promise.all(DISTRICTS.map(district => loadImage(`environments/${district.image}`))),
      Promise.all(NPC_ATLASES.map(name => Promise.all([
        loadImage(`characters/pedestrians/${name}.png`), loadJson(`characters/pedestrians/${name}.json`)
      ]))),
      Promise.all([
      loadImage('characters/samurai/samurai-idle-v2-ivory.png'),
      loadImage(`characters/samurai/${HERO_WALK}.png`),
      loadJson(`characters/samurai/${HERO_WALK}.json`),
      loadImage('vehicles/elevated-train-v1.png'),
      loadJson('vehicles/elevated-train-v1.json')
      ])
    ]);
    art.backgrounds = backgrounds;
    art.idle = prepareSprite(results[0], null, 'hero', 1);
    art.hero = prepareSprite(results[1], results[2], 'hero', 1);
    art.idle.height = 224 * art.idle.sourceHeight / art.idle.visualHeight;
    art.hero.height = 224 * art.hero.sourceHeight / art.hero.visualHeight;
    art.hero.worldCycle = art.hero.cycleDistance * art.hero.height / art.hero.sourceHeight;
    art.train = results[3];
    art.trainCrop = results[4].suggested_source_rectangle;
    const people = npcAtlases.flatMap(([image, metadata]) => metadata.characters.map(character => {
      const umbrella = character.kind === 'umbrella' || /umbrella|commuter/i.test(character.id);
      const sprite = prepareSprite(image, character, umbrella ? 'commuter' : 'person', character.default_direction ?? 1);
      return { id: character.id, sprite, height: (character.visual_height ?? (umbrella ? 250 : 210)) * sprite.sourceHeight / sprite.visualHeight };
    }));
    if (new Set(people.map(person => person.id)).size < 15) throw new Error('The city needs at least fifteen distinct pedestrians.');
    pedestrians = people.map((person, index) => {
      const size = .84 + (index % 3) * .025;
      return { ...person, x: (index + .3) / people.length * WORLD.width,
        direction: index % 2 ? 1 : -1, speed: 26 + ((index * 5) % 11), phase: index * .79,
        size, ground: npcLane(WORLD.ground, index),
        cycleDistance: person.sprite.cycleDistance * person.height * size / person.sprite.sourceHeight };
    });
    state.loaded = true;
    state.mode = 'welcome';
    resize();
    state.camera = cameraTarget(player.x, view.worldWidth, WORLD.width);
    $('start').disabled = false;
    $('start').textContent = 'Enter the city';
    $('load-status').textContent = 'Ready when you are. Press Enter to begin.';
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
  const rect = canvas.getBoundingClientRect();
  view.width = rect.width; view.height = rect.height;
  view.dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(view.width * view.dpr);
  canvas.height = Math.round(view.height * view.dpr);
  view.worldHeight = Math.min(941, WORLD.width / (view.width / view.height));
  view.scale = view.height / view.worldHeight;
  view.worldWidth = view.width / view.scale;
  view.cameraY = WORLD.ground - view.worldHeight * .89;
  state.camera = clamp(state.camera, 0, Math.max(0, WORLD.width - view.worldWidth));
}
new ResizeObserver(resize).observe(canvas);

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
    ctx.drawImage(art.backgrounds[index], x, 0, BLOCK_WIDTH, WORLD.height);
  }
  // Building-edge shadows make the joins read as passages between city blocks.
  for (let index = 1; index < DISTRICTS.length; index++) {
    const x = index * BLOCK_WIDTH;
    if (x < state.camera - 40 || x > state.camera + view.worldWidth + 40) continue;
    const shade = ctx.createLinearGradient(x - 28, 0, x + 28, 0);
    shade.addColorStop(0, 'rgba(5,9,16,0)');
    shade.addColorStop(.47, 'rgba(5,9,16,.9)');
    shade.addColorStop(.53, 'rgba(5,9,16,.9)');
    shade.addColorStop(1, 'rgba(5,9,16,0)');
    ctx.fillStyle = shade; ctx.fillRect(x - 28, 0, 56, WORLD.height);
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
  ctx.save(); ctx.translate(-state.camera, -view.cameraY);
  drawDistricts();
  drawTrain();
  drawSteam();
  ctx.restore();
  drawRain(false);
  ctx.save(); ctx.translate(-state.camera, -view.cameraY);
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
  shadow(player.x, WORLD.ground, 34, .25);
  const hero = player.moving ? art.hero : art.idle;
  footShadows(hero, player.phase, player.x, WORLD.ground, hero.height, player.direction);
  drawSprite(hero, player.phase, player.x, WORLD.ground, hero.height, player.direction);
  ctx.restore();
  drawRain(true);
}

function update(dt) {
  if (!state.loaded || !['welcome', 'playing'].includes(state.mode)) return;
  state.clock += dt;
  for (const person of pedestrians) {
    const moved = person.speed * dt;
    person.x = wrapPedestrian(person.x + person.direction * moved, WORLD.width);
    person.phase = advanceWalk(person.phase, moved, person.cycleDistance, person.sprite.frames.length);
  }
  if (state.mode === 'playing') {
    state.elapsed += dt;
    const axis = movementAxis(keys.has('KeyA') || keys.has('ArrowLeft') || touch.left, keys.has('KeyD') || keys.has('ArrowRight') || touch.right);
    const before = player.x;
    player.x = movePlayer(player.x, axis, dt, keys.has('ShiftLeft') || keys.has('ShiftRight'), WORLD.width);
    const moved = player.x - before;
    player.moving = Math.abs(moved) > .001;
    if (axis) player.direction = axis;
    if (player.moving) player.phase = advanceWalk(player.phase, moved, art.hero.worldCycle, art.hero.frames.length);
    state.nearest = closestStop(player.x, stops);
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
  canvas.dataset.npcTypes = String(pedestrians.length);
  canvas.dataset.npcIds = pedestrians.map(person => person.id).join(',');
  canvas.dataset.maxNpcSpeed = String(Math.max(0, ...pedestrians.map(person => person.speed)));
  canvas.dataset.npcGroundGap = String(Math.min(...pedestrians.map(person => WORLD.ground - person.ground)));
  canvas.dataset.heroWalkFrames = String(art.hero?.frames.length ?? 0);
  canvas.dataset.heroCycleDistance = art.hero?.worldCycle.toFixed(1) ?? '0';
  $('district-name').textContent = `${String(district + 1).padStart(2, '0')} / ${DISTRICTS[district].name.toUpperCase()}`;
  $('journey-position').style.left = `${player.x / WORLD.width * 100}%`;
  $('journey-route').setAttribute('aria-label', `District ${district + 1} of ${DISTRICTS.length}: ${DISTRICTS[district].name}`);
  $('stop-count').textContent = `${visits.size} / ${stops.length}`;
  const available = state.mode === 'playing' && state.nearest;
  $('interact').hidden = !available;
  if (available) $('interact-name').textContent = `${state.nearest.name}${visits.has(state.nearest.id) ? ' · revisit' : ''}`;
  $('touch-explore').disabled = !available;
}
function releaseControls() { keys.clear(); touch.left = false; touch.right = false; player.moving = false; }
function startWalk() {
  if (!state.loaded || state.mode !== 'welcome') return;
  state.mode = 'playing';
  $('welcome').hidden = true; $('hud').hidden = false; $('walk-hud').hidden = false; $('touch-controls').hidden = false;
  canvas.focus(); updateHud();
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
  visits.clear(); saveVisits(); player.x = START_X; player.direction = 1; player.phase = 0;
  state.elapsed = 0; state.camera = cameraTarget(player.x, view.worldWidth, WORLD.width);
  resumeWalk(); showToast('A fresh night. The city is yours to explore.');
}
function saveVisits() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify([...visits])); } catch { /* Walking still works when storage is unavailable. */ }
}
function explore() {
  if (state.mode !== 'playing' || !state.nearest) return;
  const stop = state.nearest;
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

class CityAudio {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio is not supported in this browser.');
    this.context = new AudioContext();
    const master = this.context.createGain(); master.gain.value = .21; master.connect(this.context.destination);
    const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .6;
    const noise = this.context.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const highpass = this.context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 900;
    const lowpass = this.context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 7000;
    noise.connect(highpass); highpass.connect(lowpass); lowpass.connect(master); noise.start();
    const hum = this.context.createOscillator(); hum.type = 'sine'; hum.frequency.value = 58;
    const humGain = this.context.createGain(); humGain.gain.value = .10; hum.connect(humGain); humGain.connect(master); hum.start();
    const train = this.context.createOscillator(); train.type = 'sine'; train.frequency.value = 112;
    this.trainGain = this.context.createGain(); this.trainGain.gain.value = 0; train.connect(this.trainGain); this.trainGain.connect(master); train.start();
  }
  resume() { return this.context.resume(); }
  suspend() { return this.context.suspend(); }
  setTrain(clock) {
    const cycle = ((clock * 145 + 1300) % (BLOCK_WIDTH + 2000));
    const presence = Math.max(0, 1 - Math.abs(cycle - 2100) / 900);
    this.trainGain.gain.setTargetAtTime(presence * .09, this.context.currentTime, .2);
  }
}

$('start').addEventListener('click', startWalk);
$('pause').addEventListener('click', pauseWalk);
$('resume').addEventListener('click', resumeWalk);
$('restart').addEventListener('click', restartWalk);
$('interact').addEventListener('click', explore);
$('touch-explore').addEventListener('click', explore);
$('leave-stop').addEventListener('click', leaveStop);
$('pause-dialog').addEventListener('cancel', event => { event.preventDefault(); resumeWalk(); });
$('stop-dialog').addEventListener('cancel', event => { event.preventDefault(); leaveStop(); });
$('sound').addEventListener('click', async () => {
  try {
    if (!audio) audio = new CityAudio();
    if (state.muted) { await audio.resume(); state.muted = false; }
    else { await audio.suspend(); state.muted = true; }
    $('sound').textContent = state.muted ? 'Sound off' : 'Sound on';
    $('sound').setAttribute('aria-pressed', String(!state.muted));
  } catch { showToast('Audio is unavailable here. You can still explore the city.'); }
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
  if (event.code === 'KeyE' && !event.repeat) { explore(); return; }
  if (state.mode === 'playing') keys.add(event.code);
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { releaseControls(); if (state.mode === 'playing') pauseWalk(); });
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (document.hidden) { releaseControls(); audio?.suspend(); if (state.mode === 'playing') pauseWalk(); }
});
for (const direction of ['left', 'right']) {
  const button = $(direction);
  button.addEventListener('pointerdown', event => {
    if (state.mode !== 'playing') return;
    event.preventDefault(); touch[direction] = true; button.setPointerCapture(event.pointerId);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => { touch[direction] = false; });
}
resize();
requestAnimationFrame(frame);
loadCity();
