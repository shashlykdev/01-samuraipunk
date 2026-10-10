import test from 'node:test';
import assert from 'node:assert/strict';
import { movementAxis, movePlayer, cameraTarget, districtIndex, safeDelta, wrapPedestrian, closestStop, restoreVisits } from '../engine.js';
import { BLOCK_WIDTH, DISTRICTS, WORLD, STOPS } from '../world.js';

test('opposing controls cancel and frame stalls do not teleport the player', () => {
  assert.equal(movementAxis(true, true), 0);
  assert.equal(movePlayer(500, 0, 5, false, 2000), 500);
  assert.equal(movePlayer(500, 1, 10, false, 2000), 505);
  assert.equal(safeDelta(-2), 0);
  assert.equal(safeDelta(NaN), 0);
});
test('both player movement directions stay inside the street', () => {
  assert.equal(movePlayer(66, -1, .05, true, 2000), 65);
  assert.equal(movePlayer(1934, 1, .05, true, 2000), 1935);
});
test('camera cannot expose empty space on narrow or oversized screens', () => {
  assert.equal(cameraTarget(30, 500, 2000), 0);
  assert.equal(cameraTarget(1990, 500, 2000), 1500);
  assert.equal(cameraTarget(1000, 2500, 2000), 0);
});
test('pedestrian wrap waits until the whole sprite has left the street', () => {
  assert.equal(wrapPedestrian(-179, 2000), -179);
  assert.equal(wrapPedestrian(-181, 2000), 2180);
  assert.equal(wrapPedestrian(2181, 2000), -180);
});
test('interactions select the nearest reachable storefront', () => {
  const stops = [{ id: 'a', x: 100 }, { id: 'b', x: 200 }];
  assert.equal(closestStop(190, stops)?.id, 'b');
  assert.equal(closestStop(500, stops), null);
});
test('saved progress tolerates corrupted data and removes unknown stops', () => {
  assert.deepEqual([...restoreVisits('broken', ['a'])], []);
  assert.deepEqual([...restoreVisits('{"a":true}', ['a'])], []);
  assert.deepEqual([...restoreVisits('["a","a","unknown"]', ['a'])], ['a']);
});
test('district transitions and camera continue beyond the original block', () => {
  assert.equal(districtIndex(BLOCK_WIDTH - 1, BLOCK_WIDTH, DISTRICTS.length), 0);
  assert.equal(districtIndex(BLOCK_WIDTH, BLOCK_WIDTH, DISTRICTS.length), 1);
  assert.equal(districtIndex(BLOCK_WIDTH * 2 + 1, BLOCK_WIDTH, DISTRICTS.length), 2);
  assert.equal(districtIndex(-1, BLOCK_WIDTH, DISTRICTS.length), 0);
  assert.equal(districtIndex(WORLD.width + 1, BLOCK_WIDTH, DISTRICTS.length), 2);
  assert.ok(cameraTarget(BLOCK_WIDTH * 2.5, 500, WORLD.width) > BLOCK_WIDTH * 2);
  assert.ok(movePlayer(BLOCK_WIDTH - 1, 1, .05, false, WORLD.width) > BLOCK_WIDTH);
});
test('new storefronts are reachable and existing discoveries survive the expansion', () => {
  for (const stop of STOPS) {
    assert.ok(stop.x > 65 && stop.x < WORLD.width - 65);
    assert.equal(closestStop(stop.x, STOPS)?.id, stop.id);
  }
  assert.deepEqual([...restoreVisits('["lanterns","noodles","market"]', STOPS.map(stop => stop.id))], ['lanterns', 'noodles', 'market']);
});
