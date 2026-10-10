// Each finger owns its input until release/cancel, so lifting one thumb never clears another.
export function createTouchInput() {
  const pointers = new Map();
  return {
    press(id, control) { pointers.set(id, control); },
    release(id) { pointers.delete(id); },
    clear() { pointers.clear(); },
    has(control) { return [...pointers.values()].includes(control); },
    get left() { return this.has('left'); },
    get right() { return this.has('right'); },
    get attack() { return this.has('attack'); }
  };
}

export function gameViewport(width, height, touch, safeTop = 0, safeBottom = 0) {
  const portrait = touch && height > width;
  if (portrait) {
    const worldHeight = height < 740 ? 760 : 941;
    const top = 148 + safeTop, bottom = 144 + safeBottom;
    const available = Math.max(100, height - top - bottom);
    const playHeight = Math.min(available, width * worldHeight / 720);
    return { top: top + (available - playHeight) / 2, height: playHeight, worldHeight, groundRatio: .89, portrait };
  }
  return { top: 0, height, worldHeight: touch ? 720 : 941, groundRatio: touch ? .78 : .89, portrait };
}
