import { clamp, advanceWalk, movePlayer } from './engine.js';

export const COMBOS = [
  { name: 'DRAW CUT', animation: 'slash', duration: .42, activeStart: .16, activeEnd: .28, damage: 20, reach: 142, push: 22 },
  { name: 'RETURN CUT', animation: 'backhand', duration: .46, activeStart: .18, activeEnd: .30, damage: 26, reach: 152, push: 28 },
  { name: 'STORM BREAK', animation: 'finisher', duration: .62, activeStart: .26, activeEnd: .42, damage: 44, reach: 178, push: 64 }
];
const GRAVITY = 1500;
const JUMP_SPEED = 650;

export function createHero(x) {
  return { x, direction: 1, phase: 0, moving: false, y: 0, vy: 0, health: 100, maxHealth: 100,
    stamina: 100, attack: null, nextStage: 0, comboGrace: 0, dodge: 0, dodgeCooldown: 0,
    invulnerable: 0, blink: 0, hurt: 0, landing: 0, hitChain: 0, chainTime: 0, bestCombo: 0,
    kills: 0, score: 0, pendingEvents: [] };
}
export function createEnemy(id, x, type = 'raider', boss = false) {
  const maxHealth = boss ? 300 : type === 'enforcer' ? 112 : 70;
  return { id, x, home: x, type, boss, health: maxHealth, maxHealth, direction: -1, phase: 0,
    mode: 'idle', timer: 0, cooldown: .7, stun: 0, flash: 0, deathTime: 0, attackLanded: false,
    speed: boss ? 65 : type === 'enforcer' ? 56 : 68, cycleDistance: 170,
    windup: boss ? .66 : type === 'enforcer' ? .68 : .56, reach: boss ? 126 : 98,
    damage: boss ? 22 : type === 'enforcer' ? 15 : 10 };
}
export function requestJump(hero) {
  if (hero.health <= 0 || hero.y > 0 || hero.hurt > 0 || hero.dodge > 0) return false;
  hero.vy = JUMP_SPEED; hero.y = .01; hero.landing = 0;
  hero.pendingEvents.push({ type: 'jump', x: hero.x });
  return true;
}
function startAttack(hero, stage) {
  hero.attack = { stage, time: 0, queued: false, hits: new Set(), airborne: hero.y > 0 };
  hero.comboGrace = 0;
  hero.pendingEvents.push({ type: 'swing', stage, x: hero.x });
}
export function requestAttack(hero) {
  if (hero.health <= 0 || hero.hurt > 0 || hero.dodge > 0) return false;
  if (hero.attack) { hero.attack.queued = true; return true; }
  startAttack(hero, hero.comboGrace > 0 ? hero.nextStage : 0);
  return true;
}
export function requestDodge(hero, axis = 0) {
  if (hero.health <= 0 || hero.y > 0 || hero.hurt > 0 || hero.dodgeCooldown > 0 || hero.stamina < 30) return false;
  if (axis) hero.direction = axis;
  hero.stamina -= 30; hero.dodge = .28; hero.dodgeCooldown = .7;
  hero.invulnerable = Math.max(hero.invulnerable, .32); hero.attack = null; hero.comboGrace = 0;
  hero.pendingEvents.push({ type: 'dodge', x: hero.x });
  return true;
}
export function attackFrame(attack) {
  const move = COMBOS[attack.stage];
  if (attack.time < move.activeStart * .45) return 0;
  if (attack.time < move.activeStart) return 1;
  return attack.time <= move.activeEnd ? 2 : 3;
}
function hurtHero(hero, foe, events) {
  if (hero.health <= 0 || hero.invulnerable > 0 || hero.y > 65) return;
  hero.health = Math.max(0, hero.health - foe.damage);
  hero.invulnerable = .95; hero.blink = .95; hero.hurt = .24; hero.attack = null; hero.comboGrace = 0;
  hero.hitChain = 0; hero.chainTime = 0;
  hero.x += foe.direction * 28;
  events.push({ type: 'hurt', x: hero.x, y: 115, damage: foe.damage });
  if (!hero.health) events.push({ type: 'death' });
}

// Combat uses elapsed time and world distances, independently of the renderer.
export function stepCombat(hero, enemies, seconds, input, worldWidth) {
  const dt = clamp(seconds, 0, .05);
  const events = hero.pendingEvents.splice(0);
  for (const field of ['invulnerable', 'blink', 'hurt', 'landing', 'comboGrace', 'dodgeCooldown', 'chainTime']) hero[field] = Math.max(0, hero[field] - dt);
  if (!hero.chainTime) hero.hitChain = 0;
  hero.stamina = Math.min(100, hero.stamina + (hero.dodge > 0 ? 0 : 20 * dt));
  const before = hero.x;
  if (hero.health > 0 && hero.hurt <= 0) {
    if (hero.dodge > 0) { hero.x += hero.direction * 390 * dt; hero.dodge = Math.max(0, hero.dodge - dt); }
    else {
      if (input.axis && !hero.attack) hero.direction = input.axis;
      const factor = hero.attack && hero.y <= 0 ? .32 : 1;
      hero.x = movePlayer(hero.x, input.axis, dt * factor, input.fast, worldWidth);
    }
  }
  hero.x = clamp(hero.x, 65, worldWidth - 65);
  hero.moving = Math.abs(hero.x - before) > .001 && !hero.attack && hero.dodge <= 0;
  if (hero.moving) hero.phase = advanceWalk(hero.phase, hero.x - before, input.walkCycle ?? 96.9, 8);
  if (hero.y > 0 || hero.vy > 0) {
    hero.y += hero.vy * dt - .5 * GRAVITY * dt * dt; hero.vy -= GRAVITY * dt;
    if (hero.y <= 0) { hero.y = 0; hero.vy = 0; hero.landing = .12; events.push({ type: 'land', x: hero.x }); }
  }
  if (hero.attack && hero.health > 0) {
    const attack = hero.attack, move = COMBOS[attack.stage], previousTime = attack.time;
    attack.time += dt;
    // An overlap test keeps short active windows reliable through slow frames.
    if (attack.time >= move.activeStart && previousTime <= move.activeEnd && hero.y < 180) {
      for (const foe of enemies) {
        const forward = (foe.x - hero.x) * hero.direction;
        if (foe.health <= 0 || attack.hits.has(foe.id) || forward < -24 || forward > move.reach) continue;
        attack.hits.add(foe.id);
        const damage = move.damage + (attack.airborne ? 4 : 0);
        foe.health = Math.max(0, foe.health - damage); foe.flash = .12;
        // A committed armored strike needs a dodge, jump, or combo finisher to interrupt it.
        const armored = foe.type === 'enforcer' && attack.stage !== 2 && ['windup', 'strike'].includes(foe.mode);
        if (!armored) { foe.stun = attack.stage === 2 ? .58 : .34; foe.mode = 'hurt'; foe.timer = 0; foe.cooldown = .65; }
        foe.x = clamp(foe.x + hero.direction * move.push, 65, worldWidth - 65);
        hero.hitChain++; hero.chainTime = 2.4; hero.bestCombo = Math.max(hero.bestCombo, hero.hitChain);
        hero.score += damage * Math.min(hero.hitChain, 10);
        events.push({ type: 'hit', x: foe.x, y: 125, damage, finisher: attack.stage === 2, enemyId: foe.id });
        if (!foe.health) {
          foe.mode = 'dead'; foe.deathTime = .45; hero.kills++; hero.score += foe.boss ? 1000 : 100;
          events.push({ type: 'kill', x: foe.x, enemyId: foe.id, boss: foe.boss, drop: hero.kills % 3 === 0 });
        }
      }
    }
    if (attack.time >= move.duration) {
      if (attack.queued && attack.stage < 2) startAttack(hero, attack.stage + 1);
      else { hero.nextStage = attack.stage < 2 ? attack.stage + 1 : 0; hero.comboGrace = attack.stage < 2 ? .18 : 0; hero.attack = null; }
    }
  }
  for (const foe of enemies) {
    foe.flash = Math.max(0, foe.flash - dt);
    if (foe.health <= 0) { foe.deathTime = Math.max(0, foe.deathTime - dt); continue; }
    foe.cooldown = Math.max(0, foe.cooldown - dt);
    if (foe.stun > 0) { foe.stun = Math.max(0, foe.stun - dt); continue; }
    const distance = Math.abs(hero.x - foe.x);
    if (hero.health <= 0 || distance > 600) { foe.mode = 'idle'; continue; }
    if (foe.mode === 'windup' || foe.mode === 'strike') {
      foe.timer += dt;
      if (foe.timer >= foe.windup) {
        foe.mode = 'strike';
        if (!foe.attackLanded) {
          foe.attackLanded = true;
          const forward = (hero.x - foe.x) * foe.direction;
          if (forward >= -20 && forward <= foe.reach) hurtHero(hero, foe, events);
        }
      }
      if (foe.timer >= foe.windup + .28) { foe.mode = 'idle'; foe.cooldown = foe.boss ? .62 : .85; }
    } else {
      foe.direction = hero.x >= foe.x ? 1 : -1;
      if (distance < foe.reach - 10 && foe.cooldown <= 0) {
        foe.mode = 'windup'; foe.timer = 0; foe.attackLanded = false;
      } else if (distance > 72) {
        const moved = Math.min(foe.speed * dt, distance - 72);
        foe.x += foe.direction * moved;
        foe.phase = advanceWalk(foe.phase, moved, foe.cycleDistance, 4); foe.mode = 'walk';
      } else foe.mode = 'idle';
    }
  }
  hero.x = clamp(hero.x, 65, worldWidth - 65);
  return events;
}
