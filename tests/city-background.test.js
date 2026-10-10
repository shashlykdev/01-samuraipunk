import test from 'node:test';
import assert from 'node:assert/strict';
import { cityBands, CITY_ART } from '../city-background.js';
import { DISTRICTS, BLOCK_WIDTH, WORLD } from '../world.js';

test('every city frame places both sidewalk edges and the full curb face at the same height', () => {
  const targets = [0, CITY_ART.sidewalk, CITY_ART.curbTop, CITY_ART.curbBottom, CITY_ART.height];
  for (const district of DISTRICTS) {
    assert.equal(district.pavement.length, 3, district.id);
    const bands = cityBands(district);
    for (let index = 0; index < bands.length; index++) {
      const band = bands[index];
      assert.ok(band.sourceHeight > 0, district.id);
      assert.equal(band.y, targets[index], district.id);
      assert.equal(band.y + band.height, targets[index + 1], district.id);
      if (index) assert.equal(bands[index - 1].sourceY + bands[index - 1].sourceHeight, band.sourceY);
    }
    assert.equal(bands.at(-1).sourceY + bands.at(-1).sourceHeight, CITY_ART.height);
  }
});

test('alignment preserves the city length and keeps every pedestrian lane on the sidewalk', () => {
  const scale = BLOCK_WIDTH / CITY_ART.width;
  assert.equal(WORLD.width, BLOCK_WIDTH * DISTRICTS.length);
  const playerFoot = WORLD.ground / scale;
  assert.ok(playerFoot >= CITY_ART.curbTop && playerFoot <= CITY_ART.curbBottom);
  for (const gap of [94, 106, 118]) {
    const foot = (WORLD.ground - gap) / scale;
    assert.ok(foot >= CITY_ART.sidewalk && foot < CITY_ART.curbTop);
  }
});
