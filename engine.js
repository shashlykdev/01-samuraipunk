export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const movementAxis = (left, right) => Number(Boolean(right)) - Number(Boolean(left));
export const safeDelta = seconds => clamp(Number.isFinite(seconds) ? seconds : 0, 0, 0.05);
export const cameraTarget = (x, viewWidth, worldWidth) => clamp(x - viewWidth / 2, 0, Math.max(0, worldWidth - viewWidth));
export function movePlayer(x, axis, dt, fast, worldWidth) {
  return clamp(x + clamp(axis, -1, 1) * (fast ? 170 : 100) * safeDelta(dt), 65, worldWidth - 65);
}
export function wrapPedestrian(x, worldWidth) {
  const margin = 180;
  if (x < -margin) return worldWidth + margin;
  if (x > worldWidth + margin) return -margin;
  return x;
}
export function closestStop(x, stops, radius = 105) {
  let closest = null;
  let distance = radius;
  for (const stop of stops) {
    const next = Math.abs(stop.x - x);
    if (next < distance) { closest = stop; distance = next; }
  }
  return closest;
}
export function restoreVisits(raw, validIds) {
  try {
    const saved = JSON.parse(raw);
    return new Set(Array.isArray(saved) ? saved.filter(id => validIds.includes(id)) : []);
  } catch { return new Set(); }
}
