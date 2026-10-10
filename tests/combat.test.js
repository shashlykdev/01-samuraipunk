import test from 'node:test';
import assert from 'node:assert/strict';
import { createHero, createEnemy, requestJump, requestAttack, requestDodge, stepCombat, attackFrame, COMBOS } from '../combat.js';
import { ENEMY_SPAWNS, WORLD, BLOCK_WIDTH, DISTRICTS } from '../world.js';
const input = { axis: 0, fast: false, walkCycle: 97 };
function tick(hero, foes, seconds = .05) { return stepCombat(hero, foes, seconds, input, WORLD.width); }
function target(x = 560) { const foe = createEnemy('target', x); foe.cooldown = 99; foe.speed = 0; foe.attackStart = 0; return foe; }

test('jump has a real arc, rejects double jumps, and lands on the ground', () => {
  const hero = createHero(500);
  assert.equal(requestJump(hero), true);
  assert.equal(requestJump(hero), false);
  let apex = 0, landings = 0;
  for (let i = 0; i < 70; i++) {
    const events = tick(hero, [], i % 2 ? .017 : .033);
    apex = Math.max(apex, hero.y); landings += events.filter(event => event.type === 'land').length;
  }
  assert.ok(apex > 135 && apex < 145);
  assert.equal(hero.y, 0); assert.equal(hero.vy, 0); assert.equal(landings, 1);
});
test('one slash damages a target once, even through several active frames', () => {
  const hero = createHero(500), foe = target();
  requestAttack(hero);
  let hits = 0;
  for (let i = 0; i < 9; i++) hits += tick(hero, [foe]).filter(event => event.type === 'hit').length;
  assert.equal(foe.health, 50); assert.equal(hits, 1); assert.equal(hero.hitChain, 1);
});
test('three buffered attacks chain into a stronger finisher', () => {
  const hero = createHero(500), foe = target(); foe.health = foe.maxHealth = 500;
  requestAttack(hero);
  const queued = new Set(), damages = [];
  for (let i = 0; i < 90; i++) {
    if (hero.attack && hero.attack.stage < 2 && hero.attack.time > .29 && !queued.has(hero.attack.stage)) {
      queued.add(hero.attack.stage); requestAttack(hero);
    }
    damages.push(...tick(hero, [foe]).filter(event => event.type === 'hit').map(event => event.damage));
  }
  assert.deepEqual(damages, [20, 26, 44]); assert.equal(foe.health, 410);
  assert.equal(hero.bestCombo, 3); assert.equal(hero.attack, null);
});
test('katana strikes respect direction and range', () => {
  const hero = createHero(500), behind = target(430), distant = target(800);
  requestAttack(hero);
  for (let i = 0; i < 10; i++) tick(hero, [behind, distant]);
  assert.equal(behind.health, 70); assert.equal(distant.health, 70);
});
test('dodge consumes stamina, avoids a timed strike, and cannot be spammed', () => {
  const hero = createHero(500), foe = target(575);
  foe.mode = 'windup'; foe.timer = foe.windup - .01; foe.direction = -1;
  assert.equal(requestDodge(hero, 1), true); assert.equal(hero.stamina, 70);
  assert.equal(requestDodge(hero), false);
  tick(hero, [foe], .02);
  assert.equal(hero.health, 100); assert.ok(hero.x > 500);
  for (let i = 0; i < 50; i++) tick(hero, []);
  assert.equal(hero.stamina, 100); assert.equal(requestDodge(hero), true);
});
test('jumping above a melee strike avoids damage; a grounded hit causes invulnerability', () => {
  const hero = createHero(500), foe = target(570);
  foe.mode = 'windup'; foe.timer = foe.windup - .01; foe.direction = -1;
  hero.y = 90; tick(hero, [foe], .02); assert.equal(hero.health, 100);
  hero.y = 0; hero.vy = 0; foe.mode = 'windup'; foe.timer = foe.windup - .01; foe.attackLanded = false;
  tick(hero, [foe], .02); assert.equal(hero.health, 90); assert.ok(hero.invulnerable > 0);
  foe.mode = 'windup'; foe.timer = foe.windup - .01; foe.attackLanded = false;
  tick(hero, [foe], .02); assert.equal(hero.health, 90);
});
test('health reaches zero once and defeated heroes cannot start new actions', () => {
  const hero = createHero(500), foe = target(570); hero.health = 5;
  foe.mode = 'windup'; foe.timer = foe.windup - .01; foe.direction = -1;
  const events = tick(hero, [foe], .02);
  assert.equal(hero.health, 0); assert.equal(events.filter(event => event.type === 'death').length, 1);
  assert.equal(requestAttack(hero), false); assert.equal(requestJump(hero), false); assert.equal(requestDodge(hero), false);
});
test('a defeated enemy awards one kill and cannot keep attacking or take duplicate hits', () => {
  const hero = createHero(500), foe = target(); foe.health = 10;
  requestAttack(hero);
  let kills = 0;
  for (let i = 0; i < 20; i++) kills += tick(hero, [foe]).filter(event => event.type === 'kill').length;
  assert.equal(foe.health, 0); assert.equal(hero.kills, 1); assert.equal(kills, 1); assert.equal(hero.health, 100);
});
test('every combo uses its strike frame throughout the damage window', () => {
  for (let stage = 0; stage < COMBOS.length; stage++) {
    assert.equal(attackFrame({ stage, time: COMBOS[stage].activeStart + .001 }), 2);
    assert.equal(attackFrame({ stage, time: COMBOS[stage].activeEnd - .001 }), 2);
  }
});
test('an armored windup survives a light cut but a finisher interrupts it', () => {
  const hero = createHero(500), foe = createEnemy('armor', 570, 'enforcer');
  foe.mode = 'windup'; foe.timer = .15; foe.direction = -1;
  requestAttack(hero); hero.attack.time = COMBOS[0].activeStart;
  tick(hero, [foe], .01);
  assert.equal(foe.mode, 'windup'); assert.equal(foe.stun, 0); assert.equal(foe.health, 92);
  hero.attack = null; hero.comboGrace = 0; requestAttack(hero); hero.attack.stage = 2; hero.attack.time = COMBOS[2].activeStart;
  tick(hero, [foe], .01);
  assert.equal(foe.mode, 'hurt'); assert.ok(foe.stun > .5);
});
test('all eighteen sections have fights and the commander guards the last section', () => {
  assert.equal(ENEMY_SPAWNS.length, DISTRICTS.length * 2);
  assert.equal(new Set(ENEMY_SPAWNS.map(foe => foe.id)).size, ENEMY_SPAWNS.length);
  assert.ok(ENEMY_SPAWNS.every(foe => foe.x > 65 && foe.x < WORLD.width - 65));
  const bosses = ENEMY_SPAWNS.filter(foe => foe.boss);
  assert.equal(bosses.length, 1); assert.ok(bosses[0].x > BLOCK_WIDTH * (DISTRICTS.length - 1));
});

test('enemies close on an ordinary walk and lunge from beyond the first katana cut', () => {
  const hero = createHero(500), foe = createEnemy('pursuer', 900);
  const initialGap = foe.x - hero.x;
  for (let i = 0; i < 20; i++) stepCombat(hero, [foe], .05, { ...input, axis: -1 }, WORLD.width);
  assert.ok(foe.x - hero.x < initialGap);
  hero.x = 500; foe.x = 670; foe.mode = 'idle'; foe.cooldown = 0;
  let lunged = false;
  for (let i = 0; i < 22; i++) { tick(hero, [foe]); if (foe.mode === 'strike' && foe.x < 620) lunged = true; }
  assert.ok(lunged); assert.equal(hero.health, 90);
});
test('holding light attacks in place leaves a counterattack opening', () => {
  const hero = createHero(500), foe = createEnemy('counter', 620);
  foe.health = foe.maxHealth = 500;
  for (let i = 0; i < 240 && hero.health > 0; i++) { requestAttack(hero); tick(hero, [foe], 1 / 60); }
  assert.ok(hero.health < 100, 'standing and holding attack should no longer suppress every counter');
  assert.ok(foe.health < 500, 'light cuts still deal damage');
});
test('nearby enemies take turns committing to attacks', () => {
  const hero = createHero(500), foes = [createEnemy('first', 645), createEnemy('second', 705, 'enforcer')];
  const attackers = new Set();
  for (let i = 0; i < 120; i++) {
    tick(hero, foes);
    const active = foes.filter(foe => ['windup', 'strike'].includes(foe.mode));
    assert.ok(active.length <= 1);
    active.forEach(foe => attackers.add(foe.id));
  }
  assert.equal(attackers.size, 2);
});
test('a committed lunge cannot turn around after the warning locks', () => {
  const hero = createHero(500), foe = createEnemy('locked', 650);
  foe.cooldown = 0; tick(hero, [foe]);
  while (foe.timer < foe.attackWindup * .65) tick(hero, [foe]);
  assert.equal(foe.direction, -1);
  hero.x = foe.x + 120;
  while (foe.mode === 'windup' || foe.mode === 'strike') tick(hero, [foe]);
  assert.equal(foe.direction, -1); assert.equal(hero.health, 100);
});
test('the commander telegraphs a second strike and then leaves a recovery opening', () => {
  const hero = createHero(500), foe = createEnemy('commander', 640, 'enforcer', true);
  foe.cooldown = 0; hero.invulnerable = 10;
  let followup = false, recovery = false;
  for (let i = 0; i < 60; i++) {
    tick(hero, [foe]);
    if (foe.mode === 'windup' && foe.comboIndex === 1) { followup = true; assert.ok(foe.attackWindup >= .4); }
    if (followup && foe.mode === 'recover') { recovery = true; break; }
  }
  assert.ok(followup); assert.ok(recovery);
});
