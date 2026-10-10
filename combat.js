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
export function createEnemy(id, x, type = 'raider', boss = false, options = {}) {
  const maxHealth = boss ? (options.bossHealth ?? 300) : type === 'enforcer' ? 112 : 70;
  const windup = boss ? .5 : type === 'enforcer' ? .58 : .46;
  return { id, x, home: x, type, boss, health: maxHealth, maxHealth, direction: -1, phase: 0,
    mode: 'idle', timer: 0, cooldown: .7, stun: 0, flash: 0, deathTime: 0, attackLanded: false,
    speed: boss ? 110 : type === 'enforcer' ? 96 : 112, cycleDistance: 170,
    windup, attackWindup: windup, resolve: 0, counterReady: false, comboIndex: 0,
    attackStart: boss ? 210 : type === 'enforcer' ? 190 : 176,
    lungeDistance: boss ? 100 : type === 'enforcer' ? 82 : 76, lungeRemaining: 0,
    lungeSpeed: boss ? 400 : type === 'enforcer' ? 340 : 370, reach: boss ? 128 : 108,
    damage: boss ? 18 : type === 'enforcer' ? 15 : 10,
    bossName: options.bossName ?? 'GATE COMMANDER', finalBoss: Boolean(options.finalBoss),
    bossStyle: options.bossStyle ?? 'commander', bossHealth: maxHealth, bossPhase: 1, engaged: false,
    wave: null, specialCooldown: 3 };
}

export function activeBoss(hero, enemies, radius = 820) {
  return enemies.filter(foe => foe.boss && foe.health > 0 && Math.abs(foe.x - hero.x) < radius)
    .sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0] ?? null;
}
export function remainingBosses(enemies) { return enemies.filter(foe => foe.boss && foe.health > 0).length; }

function startShockwave(foe, hero) {
  foe.direction = hero.x >= foe.x ? 1 : -1;
  foe.mode = 'slam'; foe.timer = 0; foe.wave = null;
}

function startEnemyAttack(foe, hero, followup = false) {
  foe.direction = hero.x >= foe.x ? 1 : -1;
  foe.mode = 'windup'; foe.timer = 0; foe.attackLanded = false;
  foe.attackWindup = followup ? .4 : foe.counterReady ? (foe.type === 'enforcer' ? .4 : .32) : foe.windup;
  foe.counterReady = false; foe.lungeRemaining = foe.lungeDistance;
  if (!followup) foe.comboIndex = 0;
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
        // Light cuts still damage, but repeated cuts give enemies resolve to counter.
        // Finishers always break that resolve and earn a full recovery opening.
        const committed = ['windup', 'strike'].includes(foe.mode);
        const armored = attack.stage !== 2 && (foe.resolve > 0 || (foe.type === 'enforcer' && committed));
        if (!armored) {
          foe.stun = attack.stage === 2 ? .58 : .16; foe.mode = 'hurt'; foe.timer = 0;
          foe.cooldown = attack.stage === 2 ? .55 : .08;
        }
        foe.counterReady = attack.stage !== 2;
        foe.resolve = attack.stage === 2 ? 0 : 1.15;
        foe.x = clamp(foe.x + hero.direction * move.push * (armored ? .2 : 1), 65, worldWidth - 65);
        hero.hitChain++; hero.chainTime = 2.4; hero.bestCombo = Math.max(hero.bestCombo, hero.hitChain);
        hero.score += damage * Math.min(hero.hitChain, 10);
        events.push({ type: 'hit', x: foe.x, y: 125, damage, finisher: attack.stage === 2, armored: foe.type === 'enforcer', enemyId: foe.id });
        if (!foe.health) {
          foe.mode = 'dead'; foe.deathTime = .45; hero.kills++; hero.score += foe.boss ? 1000 : 100;
          if (foe.boss) { hero.health = Math.min(hero.maxHealth, hero.health + 40); hero.stamina = 100; }
          events.push({ type: 'kill', x: foe.x, enemyId: foe.id, boss: foe.boss,
            finalBoss: foe.finalBoss, bossName: foe.bossName, drop: hero.kills % 3 === 0 });
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
    foe.resolve = Math.max(0, foe.resolve - dt);
    if (foe.health <= 0) { foe.wave = null; foe.deathTime = Math.max(0, foe.deathTime - dt); continue; }
    if (foe.boss && foe.health <= foe.maxHealth / 2 && foe.bossPhase === 1) {
      foe.bossPhase = 2; foe.speed += 14;
      events.push({ type: 'boss-phase', bossName: foe.bossName, enemyId: foe.id });
    }
    // The wave persists independently of its caster's next animation, but dies with the boss.
    if (foe.wave) {
      const wave = foe.wave, oldX = wave.x;
      wave.x += wave.direction * 310 * dt; wave.life -= dt;
      if (!wave.hit && hero.health > 0 && hero.y <= 65 && Math.abs(hero.x - (oldX + wave.x) / 2) <= 34 + Math.abs(wave.x - oldX) / 2) {
        wave.hit = true; hurtHero(hero, { ...foe, direction: wave.direction, damage: 16 }, events);
      }
      if (wave.life <= 0) foe.wave = null;
    }
    foe.specialCooldown = Math.max(0, foe.specialCooldown - dt);
    foe.cooldown = Math.max(0, foe.cooldown - dt);
    if (foe.stun > 0) { foe.stun = Math.max(0, foe.stun - dt); continue; }
    const distance = Math.abs(hero.x - foe.x);
    if (foe.boss && !foe.engaged && distance < 650 && hero.health > 0) {
      foe.engaged = true;
      events.push({ type: 'boss-enter', bossName: foe.bossName, enemyId: foe.id, finalBoss: foe.finalBoss });
    }
    if (hero.health <= 0 || distance > 820) { foe.mode = 'idle'; foe.comboIndex = 0; continue; }
    if (foe.mode === 'slam') {
      foe.timer += dt;
      if (foe.timer >= .85) {
        foe.wave = { x: foe.x, direction: foe.direction, life: 1.9, hit: false };
        foe.specialCooldown = foe.bossPhase === 2 ? 3.8 : 5;
        foe.mode = 'recover'; foe.timer = 0; foe.cooldown = 1.05;
        events.push({ type: 'boss-slam', x: foe.x, enemyId: foe.id });
      }
    } else if (foe.mode === 'windup' || foe.mode === 'strike') {
      foe.timer += dt;
      const windup = foe.attackWindup;
      // Aim early, then commit: a dodge through the last part of the tell makes the attack miss.
      if (foe.timer < windup * .55) {
        foe.direction = hero.x >= foe.x ? 1 : -1;
        const moved = Math.min(36 * dt, Math.max(0, distance - foe.reach + 12));
        foe.x = clamp(foe.x + foe.direction * moved, 65, worldWidth - 65);
      }
      if (foe.timer >= windup) {
        if (foe.mode !== 'strike') events.push({ type: 'enemy-swing', x: foe.x, boss: foe.boss });
        foe.mode = 'strike';
        const strikeTime = foe.timer - windup;
        if (strikeTime <= .22) {
          const forward = (hero.x - foe.x) * foe.direction;
          const moved = Math.min(foe.lungeSpeed * dt, foe.lungeRemaining, Math.max(0, forward - 56));
          foe.x = clamp(foe.x + foe.direction * moved, 65, worldWidth - 65);
          foe.lungeRemaining -= moved;
        }
        if (!foe.attackLanded && strikeTime <= .22) {
          const forward = (hero.x - foe.x) * foe.direction;
          if (forward >= -20 && forward <= foe.reach) { foe.attackLanded = true; hurtHero(hero, foe, events); }
        }
      }
      if (foe.timer >= windup + .3) {
        const cuts = foe.bossStyle === 'duelist' ? (foe.bossPhase === 2 ? 4 : 3) : (foe.bossPhase === 2 ? 3 : 2);
        if (foe.boss && foe.comboIndex < cuts - 1 && Math.abs(hero.x - foe.x) < 290 && hero.health > 0) {
          foe.comboIndex++; startEnemyAttack(foe, hero, true);
        } else { foe.mode = 'recover'; foe.timer = 0; foe.cooldown = foe.boss ? .85 : .7; }
      }
    } else if (foe.mode === 'recover') {
      foe.timer += dt;
      // A visible backstep gives the player room and lets the next enemy take a turn.
      const away = foe.x >= hero.x ? 1 : -1;
      if (distance < foe.attackStart + 35) {
        const before = foe.x;
        foe.x = clamp(foe.x + away * 120 * dt, 65, worldWidth - 65);
        foe.phase = advanceWalk(foe.phase, foe.x - before, foe.cycleDistance, 4);
      }
      if (foe.timer >= .36) foe.mode = 'idle';
    } else {
      foe.direction = hero.x >= foe.x ? 1 : -1;
      const allyAttacking = enemies.some(other => other !== foe && other.health > 0 && ['windup', 'strike', 'slam'].includes(other.mode) && Math.abs(other.x - hero.x) < 420);
      if (foe.boss && foe.bossStyle !== 'duelist' && distance < 430 && foe.specialCooldown <= 0 && foe.cooldown <= 0 && !allyAttacking) {
        startShockwave(foe, hero);
      } else if (distance <= foe.attackStart && foe.cooldown <= 0 && !allyAttacking) {
        startEnemyAttack(foe, hero);
      } else {
        const standOff = allyAttacking ? foe.attackStart + 45 : foe.reach - 18;
        const moved = Math.min(foe.speed * dt, Math.max(0, distance - standOff));
        foe.x += foe.direction * moved;
        foe.phase = advanceWalk(foe.phase, moved, foe.cycleDistance, 4); foe.mode = moved > 0 ? 'walk' : 'guard';
      }
    }
  }
  hero.x = clamp(hero.x, 65, worldWidth - 65);
  return events;
}
