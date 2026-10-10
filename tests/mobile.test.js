import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchInput, gameViewport } from '../mobile.js';

test('moving and attacking can be held by different fingers and released independently', () => {
  const input = createTouchInput();
  input.press(1, 'right'); input.press(2, 'attack'); input.press(3, 'jump');
  assert.equal(input.right, true); assert.equal(input.attack, true);
  input.release(3); input.release(2);
  assert.equal(input.attack, false); assert.equal(input.right, true);
  input.release(1); assert.equal(input.right, false);
});
test('canceling one pointer retains another on the same control; blur clears all held inputs', () => {
  const input = createTouchInput();
  input.press(10, 'left'); input.press(11, 'left'); input.release(10);
  assert.equal(input.left, true);
  input.press(12, 'attack'); input.clear();
  assert.equal(input.left, false); assert.equal(input.attack, false);
  input.release(11); assert.equal(input.left, false);
});
test('portrait playfields leave health and thumb controls clear on small and tall phones', () => {
  for (const [width, height, top, bottom] of [[320, 568, 0, 0], [375, 667, 0, 0], [390, 844, 47, 34], [430, 932, 59, 34]]) {
    const frame = gameViewport(width, height, true, top, bottom);
    assert.ok(frame.top >= 148 + top);
    assert.ok(frame.top + frame.height <= height - 144 - bottom + .001);
    assert.ok(width / (frame.height / frame.worldHeight) >= 720 - .001);
    assert.equal(frame.portrait, true);
  }
});
test('landscape uses a wider full-height view while desktop framing stays unchanged', () => {
  const mobile = gameViewport(844, 390, true);
  assert.equal(mobile.height, 390); assert.equal(mobile.top, 0);
  assert.ok(844 / (mobile.height / mobile.worldHeight) > 1500);
  const desktop = gameViewport(1440, 900, false);
  assert.equal(desktop.worldHeight, 941); assert.equal(desktop.groundRatio, .89);
});
